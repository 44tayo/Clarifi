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
