import { getValidAccessToken } from './sync'
import type { CalendarProvider } from './types'

export type ContactPerson = {
  displayName: string
  email?: string
  source: 'google' | 'microsoft'
  provider: CalendarProvider
}

type ContactSearchResult = {
  contacts: ContactPerson[]
  insufficientScope: boolean
}

type GooglePerson = {
  names?: Array<{ displayName?: string; givenName?: string; familyName?: string }>
  emailAddresses?: Array<{ value?: string }>
}

type DirectoryCacheEntry = {
  contacts: ContactPerson[]
  needsReconnect: boolean
  expiresAt: number
}

type QueryCacheEntry = {
  contacts: ContactPerson[]
  needsReconnect: boolean
  expiresAt: number
}

const DIRECTORY_TTL_MS = 10 * 60 * 1000
const EMPTY_DIRECTORY_TTL_MS = 30 * 1000
const QUERY_TTL_MS = 2 * 60 * 1000
const directoryCache = new Map<string, DirectoryCacheEntry>()
const queryCache = new Map<string, QueryCacheEntry>()

function googleDisplayName(person: GooglePerson): string | null {
  const named = person.names?.[0]
  const display =
    named?.displayName?.trim() ||
    [named?.givenName, named?.familyName].filter(Boolean).join(' ').trim()
  if (display) return display
  const email = person.emailAddresses?.[0]?.value?.trim()
  if (email) return email.split('@')[0] || email
  return null
}

function googleEmail(person: GooglePerson): string | undefined {
  const email = person.emailAddresses?.[0]?.value?.trim()
  return email || undefined
}

function pushUnique(
  into: ContactPerson[],
  seen: Set<string>,
  person: ContactPerson,
): void {
  const emailKey = person.email?.toLowerCase()
  const key = emailKey || `name:${person.displayName.toLowerCase()}`
  if (seen.has(key)) return
  seen.add(key)
  into.push(person)
}

function filterDirectory(contacts: ContactPerson[], query: string): ContactPerson[] {
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

function pushGooglePeople(
  results: ContactPerson[],
  seen: Set<string>,
  people: GooglePerson[],
): void {
  for (const person of people) {
    const displayName = googleDisplayName(person)
    if (!displayName) continue
    pushUnique(results, seen, {
      displayName,
      email: googleEmail(person),
      source: 'google',
      provider: 'google',
    })
  }
}

async function loadGoogleDirectory(accessToken: string): Promise<ContactSearchResult> {
  const results: ContactPerson[] = []
  const seen = new Set<string>()
  const headers = { Authorization: `Bearer ${accessToken}` }

  try {
    let pageToken: string | undefined
    let pages = 0
    do {
      const listUrl = new URL('https://people.googleapis.com/v1/people/me/connections')
      listUrl.searchParams.set('personFields', 'names,emailAddresses')
      listUrl.searchParams.set('pageSize', '200')
      listUrl.searchParams.set('sortOrder', 'LAST_MODIFIED_DESCENDING')
      if (pageToken) listUrl.searchParams.set('pageToken', pageToken)

      const listRes = await fetch(listUrl, { headers })
      if (listRes.status === 403) {
        return { contacts: [], insufficientScope: true }
      }
      if (!listRes.ok) break

      const data = (await listRes.json()) as {
        connections?: GooglePerson[]
        nextPageToken?: string
      }
      pushGooglePeople(results, seen, data.connections ?? [])
      pageToken = data.nextPageToken
      pages += 1
    } while (pageToken && pages < 3 && results.length < 600)
  } catch (error) {
    console.error('Google contacts directory failed:', error)
  }

  return { contacts: results, insufficientScope: false }
}

/** Live Google search — includes Contacts + Other contacts (email history). */
async function searchGoogleContacts(
  accessToken: string,
  query: string,
): Promise<ContactSearchResult> {
  const results: ContactPerson[] = []
  const seen = new Set<string>()
  const headers = { Authorization: `Bearer ${accessToken}` }
  const q = query.trim()
  if (!q) return { contacts: [], insufficientScope: false }

  try {
    const searchUrl = new URL('https://people.googleapis.com/v1/people:searchContacts')
    searchUrl.searchParams.set('query', q)
    searchUrl.searchParams.set('readMask', 'names,emailAddresses')
    searchUrl.searchParams.set('pageSize', '25')

    const otherUrl = new URL('https://people.googleapis.com/v1/otherContacts:search')
    otherUrl.searchParams.set('query', q)
    otherUrl.searchParams.set('readMask', 'names,emailAddresses')
    otherUrl.searchParams.set('pageSize', '25')

    const [searchRes, otherRes] = await Promise.all([
      fetch(searchUrl, { headers }),
      fetch(otherUrl, { headers }),
    ])

    if (searchRes.status === 403 || otherRes.status === 403) {
      return { contacts: [], insufficientScope: true }
    }

    if (searchRes.ok) {
      const data = (await searchRes.json()) as {
        results?: Array<{ person?: GooglePerson }>
      }
      pushGooglePeople(
        results,
        seen,
        (data.results ?? []).map((item) => item.person).filter(Boolean) as GooglePerson[],
      )
    }

    if (otherRes.ok) {
      const data = (await otherRes.json()) as {
        results?: Array<{ person?: GooglePerson }>
      }
      pushGooglePeople(
        results,
        seen,
        (data.results ?? []).map((item) => item.person).filter(Boolean) as GooglePerson[],
      )
    }
  } catch (error) {
    console.error('Google contacts search failed:', error)
  }

  return { contacts: results, insufficientScope: false }
}

type GraphContact = {
  displayName?: string
  emailAddresses?: Array<{ address?: string; name?: string }>
}

type GraphPerson = {
  displayName?: string
  scoredEmailAddresses?: Array<{ address?: string }>
}

async function loadMicrosoftDirectory(accessToken: string): Promise<ContactSearchResult> {
  const results: ContactPerson[] = []
  const seen = new Set<string>()
  const headers = { Authorization: `Bearer ${accessToken}` }

  try {
    let nextUrl: string | null =
      'https://graph.microsoft.com/v1.0/me/contacts?$top=100&$select=displayName,emailAddresses&$orderby=displayName'
    let pages = 0

    while (nextUrl && pages < 3 && results.length < 600) {
      const contactsRes = await fetch(nextUrl, { headers })
      if (contactsRes.status === 403) {
        return { contacts: [], insufficientScope: true }
      }
      if (!contactsRes.ok) break

      const data = (await contactsRes.json()) as {
        value?: GraphContact[]
        '@odata.nextLink'?: string
      }
      for (const person of data.value ?? []) {
        const displayName =
          person.displayName?.trim() ||
          person.emailAddresses?.[0]?.name?.trim() ||
          person.emailAddresses?.[0]?.address?.trim()
        if (!displayName) continue
        pushUnique(results, seen, {
          displayName,
          email: person.emailAddresses?.[0]?.address?.trim() || undefined,
          source: 'microsoft',
          provider: 'microsoft',
        })
      }
      nextUrl = data['@odata.nextLink'] ?? null
      pages += 1
    }
  } catch (error) {
    console.error('Microsoft contacts directory failed:', error)
  }

  return { contacts: results, insufficientScope: false }
}

async function searchMicrosoftContacts(
  accessToken: string,
  query: string,
): Promise<ContactSearchResult> {
  const results: ContactPerson[] = []
  const seen = new Set<string>()
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    ConsistencyLevel: 'eventual',
  }
  const q = query.trim()
  if (!q) return { contacts: [], insufficientScope: false }

  try {
    const peopleUrl = new URL('https://graph.microsoft.com/v1.0/me/people')
    peopleUrl.searchParams.set('$top', '20')
    peopleUrl.searchParams.set('$select', 'displayName,scoredEmailAddresses')
    peopleUrl.searchParams.set('$search', `"${q.replace(/"/g, '')}"`)

    const contactsUrl = new URL('https://graph.microsoft.com/v1.0/me/contacts')
    contactsUrl.searchParams.set('$top', '20')
    contactsUrl.searchParams.set('$select', 'displayName,emailAddresses')
    contactsUrl.searchParams.set(
      '$filter',
      `startswith(displayName,'${q.replace(/'/g, "''")}')`,
    )

    const [peopleRes, contactsRes] = await Promise.all([
      fetch(peopleUrl, { headers }),
      fetch(contactsUrl, { headers }),
    ])

    if (peopleRes.status === 403 || contactsRes.status === 403) {
      return { contacts: [], insufficientScope: true }
    }

    if (peopleRes.ok) {
      const data = (await peopleRes.json()) as { value?: GraphPerson[] }
      for (const person of data.value ?? []) {
        const displayName = person.displayName?.trim()
        if (!displayName) continue
        pushUnique(results, seen, {
          displayName,
          email: person.scoredEmailAddresses?.[0]?.address?.trim() || undefined,
          source: 'microsoft',
          provider: 'microsoft',
        })
      }
    }

    if (contactsRes.ok) {
      const data = (await contactsRes.json()) as { value?: GraphContact[] }
      for (const person of data.value ?? []) {
        const displayName =
          person.displayName?.trim() ||
          person.emailAddresses?.[0]?.name?.trim() ||
          person.emailAddresses?.[0]?.address?.trim()
        if (!displayName) continue
        pushUnique(results, seen, {
          displayName,
          email: person.emailAddresses?.[0]?.address?.trim() || undefined,
          source: 'microsoft',
          provider: 'microsoft',
        })
      }
    }
  } catch (error) {
    console.error('Microsoft contacts search failed:', error)
  }

  return { contacts: results, insufficientScope: false }
}

async function buildDirectory(
  userId: string,
): Promise<{ contacts: ContactPerson[]; needsReconnect: boolean }> {
  const providers = ['google', 'microsoft'] as const
  const authResults = await Promise.all(
    providers.map(async (provider) => {
      const auth = await getValidAccessToken(userId, provider)
      return { provider, auth }
    }),
  )

  const loads = authResults
    .filter((item) => item.auth)
    .map(async (item) => {
      const accessToken = item.auth!.accessToken
      return item.provider === 'google'
        ? loadGoogleDirectory(accessToken)
        : loadMicrosoftDirectory(accessToken)
    })

  if (loads.length === 0) {
    return { contacts: [], needsReconnect: false }
  }

  const found = await Promise.all(loads)
  const merged: ContactPerson[] = []
  const seen = new Set<string>()
  let needsReconnect = false

  for (const result of found) {
    if (result.insufficientScope) needsReconnect = true
    for (const person of result.contacts) {
      pushUnique(merged, seen, person)
    }
  }

  merged.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
  )

  return {
    contacts: merged,
    needsReconnect: needsReconnect && merged.length === 0,
  }
}

async function getCachedDirectory(
  userId: string,
): Promise<{ contacts: ContactPerson[]; needsReconnect: boolean }> {
  const cached = directoryCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) {
    return { contacts: cached.contacts, needsReconnect: cached.needsReconnect }
  }

  const built = await buildDirectory(userId)
  const ttl =
    built.contacts.length === 0 ? EMPTY_DIRECTORY_TTL_MS : DIRECTORY_TTL_MS
  directoryCache.set(userId, {
    contacts: built.contacts,
    needsReconnect: built.needsReconnect,
    expiresAt: Date.now() + ttl,
  })
  return built
}

async function liveSearchProviders(
  userId: string,
  query: string,
): Promise<{ contacts: ContactPerson[]; needsReconnect: boolean }> {
  const providers = ['google', 'microsoft'] as const
  const authResults = await Promise.all(
    providers.map(async (provider) => {
      const auth = await getValidAccessToken(userId, provider)
      return { provider, auth }
    }),
  )

  const loads = authResults
    .filter((item) => item.auth)
    .map(async (item) => {
      const accessToken = item.auth!.accessToken
      return item.provider === 'google'
        ? searchGoogleContacts(accessToken, query)
        : searchMicrosoftContacts(accessToken, query)
    })

  if (loads.length === 0) {
    return { contacts: [], needsReconnect: false }
  }

  const found = await Promise.all(loads)
  const merged: ContactPerson[] = []
  const seen = new Set<string>()
  let needsReconnect = false

  for (const result of found) {
    if (result.insufficientScope) needsReconnect = true
    for (const person of result.contacts) {
      pushUnique(merged, seen, person)
    }
  }

  merged.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
  )

  return {
    contacts: merged.slice(0, 40),
    needsReconnect: needsReconnect && merged.length === 0,
  }
}

/** Drop cached directory after reconnect so the next search picks up new scopes. */
export function invalidateContactDirectoryCache(userId?: string): void {
  if (userId) {
    directoryCache.delete(userId)
    for (const key of queryCache.keys()) {
      if (key.startsWith(`${userId}:`)) queryCache.delete(key)
    }
    return
  }
  directoryCache.clear()
  queryCache.clear()
}

export async function searchConnectedContacts(
  userId: string,
  query: string,
): Promise<{ contacts: ContactPerson[]; needsReconnect: boolean }> {
  const q = query.trim()

  // Empty query: cached connections directory for Speakers open / prefetch.
  if (!q) {
    const directory = await getCachedDirectory(userId)
    return {
      contacts: filterDirectory(directory.contacts, ''),
      needsReconnect: directory.needsReconnect,
    }
  }

  const cacheKey = `${userId}:${q.toLowerCase()}`
  const cachedQuery = queryCache.get(cacheKey)
  if (cachedQuery && cachedQuery.expiresAt > Date.now()) {
    return {
      contacts: cachedQuery.contacts,
      needsReconnect: cachedQuery.needsReconnect,
    }
  }

  // Instant hits from saved Contacts, then live Google/Microsoft search
  // (Other contacts / People) in parallel so Gmail autocomplete-style matches appear.
  const [directory, live] = await Promise.all([
    getCachedDirectory(userId),
    liveSearchProviders(userId, q),
  ])

  const merged: ContactPerson[] = []
  const seen = new Set<string>()
  for (const person of filterDirectory(directory.contacts, q)) {
    pushUnique(merged, seen, person)
  }
  for (const person of live.contacts) {
    pushUnique(merged, seen, person)
  }

  merged.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
  )

  const result = {
    contacts: merged.slice(0, 40),
    needsReconnect:
      (directory.needsReconnect || live.needsReconnect) && merged.length === 0,
  }

  // Only cache productive searches; empty misses expire quickly so retries work.
  queryCache.set(cacheKey, {
    ...result,
    expiresAt: Date.now() + (result.contacts.length === 0 ? EMPTY_DIRECTORY_TTL_MS : QUERY_TTL_MS),
  })

  return result
}
