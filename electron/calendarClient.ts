import fetch from 'node-fetch'

import type { CalendarEventsResponse, CalendarStatus } from '../shared/calendar'
import { getDeviceCredentials } from './deviceAuth'
import { getClarifiApiUrl } from './keys'

async function deviceHeaders(): Promise<Record<string, string> | null> {
  const creds = await getDeviceCredentials()
  if (!creds) return null
  return {
    'X-Clarifi-Device-Id': creds.deviceId,
    'X-Clarifi-Device-Secret': creds.deviceSecret,
  }
}

async function deviceGet<T>(path: string): Promise<{ ok: boolean; status: number; data: T | null }> {
  const baseUrl = getClarifiApiUrl()
  const headers = await deviceHeaders()
  if (!baseUrl || !headers) {
    return { ok: false, status: 401, data: null }
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, { headers })
    let data: T | null = null
    try {
      data = (await response.json()) as T
    } catch {
      data = null
    }
    return { ok: response.ok, status: response.status, data }
  } catch {
    return { ok: false, status: 0, data: null }
  }
}

export async function fetchCalendarStatus(): Promise<CalendarStatus> {
  const empty: CalendarStatus = {
    connected: false,
    google: { provider: 'google', connected: false, accountEmail: null },
    microsoft: { provider: 'microsoft', connected: false, accountEmail: null },
  }

  const { ok, data } = await deviceGet<CalendarStatus>('/api/desktop/calendar/status')
  if (!ok || !data) return empty
  return data
}

export async function fetchCalendarEvents(): Promise<CalendarEventsResponse> {
  const empty: CalendarEventsResponse = { connected: false, events: [] }
  const { ok, data } = await deviceGet<CalendarEventsResponse>('/api/desktop/calendar/events')
  if (!ok || !data) return empty
  return data
}

/** OAuth URL bound to the paired Clarifi account (not the browser session). */
export async function fetchCalendarOAuthUrl(
  provider: 'google' | 'microsoft',
): Promise<{ ok: boolean; authUrl?: string; error?: string }> {
  const { ok, status, data } = await deviceGet<{
    ok?: boolean
    authUrl?: string
    error?: string
  }>(`/api/desktop/calendar/oauth-url?provider=${provider}`)

  if (!ok || !data?.authUrl) {
    return {
      ok: false,
      error: data?.error || (status === 401 ? 'unauthorized' : 'oauth_url_failed'),
    }
  }

  return { ok: true, authUrl: data.authUrl }
}

type ContactsSearchResult = {
  connected: boolean
  contacts: Array<{ displayName: string; email?: string; source: string }>
  needsReconnect: boolean
}

const DIRECTORY_TTL_MS = 10 * 60 * 1000
const EMPTY_TTL_MS = 30 * 1000
const QUERY_TTL_MS = 2 * 60 * 1000

let directoryCache: { expiresAt: number; result: ContactsSearchResult } | null = null
let directoryInFlight: Promise<ContactsSearchResult> | null = null
const queryCache = new Map<string, { expiresAt: number; result: ContactsSearchResult }>()
const queryInFlight = new Map<string, Promise<ContactsSearchResult>>()

function filterLocalContacts(
  contacts: ContactsSearchResult['contacts'],
  query: string,
): ContactsSearchResult['contacts'] {
  const q = query.trim().toLowerCase()
  if (!q) return contacts.slice(0, 600)
  return contacts
    .filter((person) => {
      const name = person.displayName.toLowerCase()
      const email = person.email?.toLowerCase() ?? ''
      return name.includes(q) || email.includes(q)
    })
    .slice(0, 40)
}

async function fetchContactsFromApi(query: string): Promise<ContactsSearchResult> {
  const empty: ContactsSearchResult = {
    connected: false,
    contacts: [],
    needsReconnect: false,
  }
  const q = encodeURIComponent(query.trim())
  const { ok, data } = await deviceGet<{
    connected?: boolean
    contacts?: Array<{ displayName: string; email?: string; source: string }>
    needsReconnect?: boolean
  }>(`/api/desktop/calendar/contacts?q=${q}`)
  if (!ok || !data) return empty
  return {
    connected: Boolean(data.connected),
    contacts: Array.isArray(data.contacts) ? data.contacts : [],
    needsReconnect: Boolean(data.needsReconnect),
  }
}

export function invalidateCalendarContactsCache(): void {
  directoryCache = null
  directoryInFlight = null
  queryCache.clear()
  queryInFlight.clear()
}

async function getDirectory(): Promise<ContactsSearchResult> {
  const now = Date.now()
  if (directoryCache && directoryCache.expiresAt > now) {
    return directoryCache.result
  }

  if (!directoryInFlight) {
    directoryInFlight = fetchContactsFromApi('')
      .then((result) => {
        // Network failures stay uncached so the next open retries.
        if (!result.connected && result.contacts.length === 0 && !result.needsReconnect) {
          return result
        }
        const ttl = result.contacts.length === 0 ? EMPTY_TTL_MS : DIRECTORY_TTL_MS
        directoryCache = { expiresAt: Date.now() + ttl, result }
        return result
      })
      .finally(() => {
        directoryInFlight = null
      })
  }

  return directoryInFlight
}

export async function searchCalendarContacts(query: string): Promise<ContactsSearchResult> {
  const q = query.trim()

  if (!q) {
    return getDirectory()
  }

  const key = q.toLowerCase()
  const cached = queryCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result
  }

  // Show local directory matches immediately while live search runs on the API.
  const directory = await getDirectory()
  const localHits = filterLocalContacts(directory.contacts, q)

  let inFlight = queryInFlight.get(key)
  if (!inFlight) {
    inFlight = fetchContactsFromApi(q)
      .then((result) => {
        const ttl = result.contacts.length === 0 ? EMPTY_TTL_MS : QUERY_TTL_MS
        queryCache.set(key, { expiresAt: Date.now() + ttl, result })
        return result
      })
      .finally(() => {
        queryInFlight.delete(key)
      })
    queryInFlight.set(key, inFlight)
  }

  const live = await inFlight
  if (live.contacts.length > 0 || live.needsReconnect) {
    return live
  }

  // Fall back to local directory filter if live search returned nothing.
  return {
    connected: directory.connected || live.connected,
    contacts: localHits,
    needsReconnect: directory.needsReconnect || live.needsReconnect,
  }
}

export async function disconnectCalendarProvider(
  provider: 'google' | 'microsoft',
): Promise<{ ok: boolean; error?: string }> {
  const baseUrl = getClarifiApiUrl()
  const headers = await deviceHeaders()
  if (!baseUrl || !headers) {
    return { ok: false, error: 'unauthorized' }
  }

  try {
    const response = await fetch(`${baseUrl}/api/desktop/calendar/disconnect`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    })
    let data: { ok?: boolean; error?: string } | null = null
    try {
      data = (await response.json()) as { ok?: boolean; error?: string }
    } catch {
      data = null
    }
    if (!response.ok || !data?.ok) {
      return {
        ok: false,
        error: data?.error || (response.status === 401 ? 'unauthorized' : 'disconnect_failed'),
      }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'disconnect_failed' }
  }
}
