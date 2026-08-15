import { getValidAccessToken } from './sync'
import type { CalendarProvider } from './types'

export type ContactPerson = {
  displayName: string
  email?: string
  photoUrl?: string
  source: 'google' | 'microsoft'
  provider: CalendarProvider
}

type ContactSearchResult = {
  contacts: ContactPerson[]
  /** Missing OAuth scopes or auth rejected by People API. */
  insufficientScope: boolean
  /** People API returned a non-OK status we shouldn't ignore. */
  apiFailed?: boolean
}

type GooglePerson = {
  names?: Array<{ displayName?: string; givenName?: string; familyName?: string }>
  emailAddresses?: Array<{ value?: string }>
  photos?: Array<{
    url?: string
    default?: boolean
    metadata?: { source?: { type?: string } }
  }>
}

const GOOGLE_PERSON_FIELDS = 'names,emailAddresses,photos'
const GOOGLE_READ_MASK = 'names,emailAddresses,photos'

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
const EMPTY_DIRECTORY_TTL_MS = 15 * 1000
const QUERY_TTL_MS = 2 * 60 * 1000
/** Google asks for an empty searchContacts warmup every few days; refresh ours sooner. */
const GOOGLE_SEARCH_WARMUP_TTL_MS = 12 * 60 * 60 * 1000
const GOOGLE_SEARCH_WARMUP_WAIT_MS = 3000
const GOOGLE_DIRECTORY_PAGE_SIZE = 200
const GOOGLE_DIRECTORY_MAX_PAGES = 25
const GOOGLE_DIRECTORY_MAX_CONTACTS = 5000
const MICROSOFT_DIRECTORY_MAX_PAGES = 25
const MICROSOFT_DIRECTORY_MAX_CONTACTS = 5000
const GOOGLE_CONTACTS_SCOPE = 'https://www.googleapis.com/auth/contacts.readonly'
const GOOGLE_OTHER_CONTACTS_SCOPE = 'https://www.googleapis.com/auth/contacts.other.readonly'
const directoryCache = new Map<string, DirectoryCacheEntry>()
const queryCache = new Map<string, QueryCacheEntry>()
/** Token fingerprint → last successful searchContacts warmup. */
const googleSearchWarmupAt = new Map<string, number>()
const googleSearchWarmupInFlight = new Map<string, Promise<void>>()

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function tokenFingerprint(accessToken: string): string {
  return accessToken.slice(0, 24)
}

function isPeopleAuthFailure(status: number): boolean {
  return status === 401 || status === 403
}

function scopeListHas(scopes: string[], wanted: string): boolean {
  const suffix = wanted.replace(/^https:\/\/www\.googleapis\.com/, '')
  return scopes.some((scope) => scope === wanted || scope.endsWith(suffix))
}

/** True when the access token is missing Contacts and/or Other contacts scopes. */
async function googleTokenMissingContactsScope(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
    )
    if (!res.ok) {
      console.warn('[contacts] tokeninfo failed', res.status)
      return false
    }
    const data = (await res.json()) as { scope?: string }
    const scopes = (data.scope ?? '').split(/\s+/).filter(Boolean)
    // Require exact contacts.readonly — do not treat contacts.other.readonly as a match.
    const hasContacts = scopes.some(
      (scope) =>
        scope === GOOGLE_CONTACTS_SCOPE ||
        (scope.endsWith('/auth/contacts.readonly') && !scope.includes('other')),
    )
    const hasOther = scopeListHas(scopes, GOOGLE_OTHER_CONTACTS_SCOPE)
    if (!hasContacts || !hasOther) {
      console.warn('[contacts] Google token missing contacts scopes', {
        hasContacts,
        hasOther,
        scopeCount: scopes.length,
      })
      return true
    }
    return false
  } catch (error) {
    console.error('[contacts] tokeninfo check failed:', error)
    return false
  }
}

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

function googlePhotoUrl(person: GooglePerson): string | undefined {
  const photos = person.photos ?? []
  // Prefer a real Google account / contact photo over the default silhouette stub.
  const preferred =
    photos.find(
      (photo) =>
        photo.url?.trim() &&
        photo.default !== true &&
        photo.metadata?.source?.type === 'PROFILE',
    ) ??
    photos.find((photo) => photo.url?.trim() && photo.default !== true) ??
    photos.find(
      (photo) => photo.url?.trim() && photo.metadata?.source?.type === 'PROFILE',
    ) ??
    photos.find((photo) => photo.url?.trim() && photo.default !== true) ??
    photos.find((photo) => photo.url?.trim())
  const url = preferred?.url?.trim()
  if (!url) return undefined
  // Skip Google's empty default avatar stub when that's all we got.
  if (preferred?.default === true && photos.length === 1) return undefined
  // Request a crisp avatar size when Google serves size-parameterized URLs.
  return url.includes('=s') ? url.replace(/=s\d+(-[a-z]+)?$/, '=s128$1') : url
}

/** Other contacts need PROFILE source to return real Gmail account photos. */
function appendGoogleContactSources(url: URL): void {
  url.searchParams.append('sources', 'READ_SOURCE_TYPE_CONTACT')
  url.searchParams.append('sources', 'READ_SOURCE_TYPE_PROFILE')
}

function pushUnique(
  into: ContactPerson[],
  seen: Set<string>,
  person: ContactPerson,
): void {
  const emailKey = person.email?.toLowerCase()
  const key = emailKey || `name:${person.displayName.toLowerCase()}`
  const existing = emailKey
    ? into.find((item) => item.email?.toLowerCase() === emailKey)
    : undefined
  if (existing) {
    if (!existing.photoUrl && person.photoUrl) existing.photoUrl = person.photoUrl
    if (existing.displayName === existing.email?.split('@')[0] && person.displayName) {
      existing.displayName = person.displayName
    }
    return
  }
  if (seen.has(key)) return
  seen.add(key)
  into.push(person)
}

function filterDirectory(contacts: ContactPerson[], query: string): ContactPerson[] {
  const q = query.trim().toLowerCase()
  if (!q) return contacts.slice(0, GOOGLE_DIRECTORY_MAX_CONTACTS)
  return contacts
    .filter((person) => {
      const name = person.displayName.toLowerCase()
      const email = person.email?.toLowerCase() ?? ''
      const local = email.split('@')[0] ?? ''
      return name.includes(q) || email.includes(q) || local.includes(q)
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
      photoUrl: googlePhotoUrl(person),
      source: 'google',
      provider: 'google',
    })
  }
}

/**
 * Google People API requires an empty searchContacts warmup (every few days)
 * or live searches often return 200 with zero results.
 * https://developers.google.com/people/v1/contacts#search_the_users_contacts
 */
async function ensureGoogleSearchWarmup(
  accessToken: string,
  options?: { force?: boolean },
): Promise<{ insufficientScope: boolean; apiFailed: boolean }> {
  const key = tokenFingerprint(accessToken)
  const warmedAt = googleSearchWarmupAt.get(key) ?? 0
  if (!options?.force && Date.now() - warmedAt < GOOGLE_SEARCH_WARMUP_TTL_MS) {
    return { insufficientScope: false, apiFailed: false }
  }

  const existing = googleSearchWarmupInFlight.get(key)
  if (existing) {
    await existing
    if (!options?.force) return { insufficientScope: false, apiFailed: false }
  }

  const warmup = (async () => {
    const warmupUrl = new URL('https://people.googleapis.com/v1/people:searchContacts')
    warmupUrl.searchParams.set('query', '')
    warmupUrl.searchParams.set('readMask', GOOGLE_READ_MASK)
    warmupUrl.searchParams.set('pageSize', '1')

    const res = await fetch(warmupUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (isPeopleAuthFailure(res.status)) {
      throw Object.assign(new Error('insufficient_scope'), {
        insufficientScope: true,
        status: res.status,
      })
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[contacts] Google searchContacts warmup failed', res.status, body.slice(0, 300))
      throw Object.assign(new Error('warmup_failed'), { apiFailed: true, status: res.status })
    }
    // Index rebuild is async on Google's side; pause before the first real search.
    await sleep(GOOGLE_SEARCH_WARMUP_WAIT_MS)
    googleSearchWarmupAt.set(key, Date.now())
  })()

  googleSearchWarmupInFlight.set(key, warmup)
  try {
    await warmup
    return { insufficientScope: false, apiFailed: false }
  } catch (error) {
    if (error && typeof error === 'object') {
      if ('insufficientScope' in error && (error as { insufficientScope?: boolean }).insufficientScope) {
        return { insufficientScope: true, apiFailed: false }
      }
      if ('apiFailed' in error && (error as { apiFailed?: boolean }).apiFailed) {
        return { insufficientScope: false, apiFailed: true }
      }
    }
    console.error('[contacts] Google contacts search warmup failed:', error)
    return { insufficientScope: false, apiFailed: true }
  } finally {
    googleSearchWarmupInFlight.delete(key)
  }
}

async function loadGoogleDirectory(accessToken: string): Promise<ContactSearchResult> {
  const results: ContactPerson[] = []
  const seen = new Set<string>()
  const headers = { Authorization: `Bearer ${accessToken}` }

  if (await googleTokenMissingContactsScope(accessToken)) {
    return { contacts: [], insufficientScope: true, apiFailed: false }
  }

  // Warm the search index while we page Connections so typed search works immediately after.
  void ensureGoogleSearchWarmup(accessToken)

  let apiFailed = false
  let insufficientScope = false

  try {
    let pageToken: string | undefined
    let pages = 0
    let connectionsOk = false
    do {
      const listUrl = new URL('https://people.googleapis.com/v1/people/me/connections')
      listUrl.searchParams.set('personFields', GOOGLE_PERSON_FIELDS)
      listUrl.searchParams.set('pageSize', String(GOOGLE_DIRECTORY_PAGE_SIZE))
      listUrl.searchParams.set('sortOrder', 'FIRST_NAME_ASCENDING')
      appendGoogleContactSources(listUrl)
      if (pageToken) listUrl.searchParams.set('pageToken', pageToken)

      const listRes = await fetch(listUrl, { headers })
      if (isPeopleAuthFailure(listRes.status)) {
        console.warn('[contacts] connections.list auth failure', listRes.status)
        return { contacts: [], insufficientScope: true, apiFailed: false }
      }
      if (!listRes.ok) {
        const body = await listRes.text().catch(() => '')
        console.error('[contacts] connections.list failed', listRes.status, body.slice(0, 300))
        apiFailed = true
        break
      }

      connectionsOk = true
      const data = (await listRes.json()) as {
        connections?: GooglePerson[]
        nextPageToken?: string
      }
      pushGooglePeople(results, seen, data.connections ?? [])
      pageToken = data.nextPageToken
      pages += 1
    } while (
      pageToken &&
      pages < GOOGLE_DIRECTORY_MAX_PAGES &&
      results.length < GOOGLE_DIRECTORY_MAX_CONTACTS
    )

    // Also pull Other contacts (Gmail autocomplete history) — paginated.
    let otherPageToken: string | undefined
    let otherPages = 0
    do {
      const otherUrl = new URL('https://people.googleapis.com/v1/otherContacts')
      otherUrl.searchParams.set('readMask', GOOGLE_READ_MASK)
      otherUrl.searchParams.set('pageSize', String(GOOGLE_DIRECTORY_PAGE_SIZE))
      appendGoogleContactSources(otherUrl)
      if (otherPageToken) otherUrl.searchParams.set('pageToken', otherPageToken)

      const otherRes = await fetch(otherUrl, { headers })
      if (isPeopleAuthFailure(otherRes.status)) {
        console.warn('[contacts] otherContacts.list auth failure', otherRes.status)
        // Other contacts power Gmail autocomplete — missing scope means Share search is broken.
        insufficientScope = true
        if (results.filter((person) => person.email).length === 0) {
          return { contacts: [], insufficientScope: true, apiFailed: false }
        }
        break
      }
      if (!otherRes.ok) {
        const body = await otherRes.text().catch(() => '')
        console.error('[contacts] otherContacts.list failed', otherRes.status, body.slice(0, 300))
        if (!connectionsOk && results.length === 0) apiFailed = true
        break
      }

      const data = (await otherRes.json()) as {
        otherContacts?: GooglePerson[]
        nextPageToken?: string
      }
      pushGooglePeople(results, seen, data.otherContacts ?? [])
      otherPageToken = data.nextPageToken
      otherPages += 1
    } while (
      otherPageToken &&
      otherPages < GOOGLE_DIRECTORY_MAX_PAGES &&
      results.length < GOOGLE_DIRECTORY_MAX_CONTACTS
    )

    const withEmail = results.filter((person) => person.email).length
    const withPhoto = results.filter((person) => person.photoUrl).length
    console.warn('[contacts] Google directory loaded', {
      count: results.length,
      withEmail,
      withPhoto,
      pages,
      otherPages,
      insufficientScope,
      apiFailed,
    })

    // People without emails aren't usable in Share; if Other contacts failed, force reconnect.
    if (withEmail === 0 && insufficientScope) {
      return { contacts: [], insufficientScope: true, apiFailed: false }
    }
  } catch (error) {
    console.error('[contacts] Google contacts directory failed:', error)
    apiFailed = true
  }

  return { contacts: results, insufficientScope, apiFailed }
}

async function fetchGoogleLiveSearch(
  accessToken: string,
  query: string,
): Promise<{
  people: GooglePerson[]
  insufficientScope: boolean
  apiFailed: boolean
}> {
  const headers = { Authorization: `Bearer ${accessToken}` }
  const searchUrl = new URL('https://people.googleapis.com/v1/people:searchContacts')
  searchUrl.searchParams.set('query', query)
  searchUrl.searchParams.set('readMask', GOOGLE_READ_MASK)
  searchUrl.searchParams.set('pageSize', '30')
  appendGoogleContactSources(searchUrl)

  const otherUrl = new URL('https://people.googleapis.com/v1/otherContacts:search')
  otherUrl.searchParams.set('query', query)
  otherUrl.searchParams.set('readMask', GOOGLE_READ_MASK)
  otherUrl.searchParams.set('pageSize', '30')
  // otherContacts:search does not accept sources[]; profile photos come from directory list.

  const [searchRes, otherRes] = await Promise.all([
    fetch(searchUrl, { headers }),
    fetch(otherUrl, { headers }),
  ])

  if (isPeopleAuthFailure(searchRes.status) || isPeopleAuthFailure(otherRes.status)) {
    console.warn('[contacts] live search auth failure', {
      search: searchRes.status,
      other: otherRes.status,
      query,
    })
    return { people: [], insufficientScope: true, apiFailed: false }
  }

  let apiFailed = false
  const people: GooglePerson[] = []
  if (searchRes.ok) {
    const data = (await searchRes.json()) as {
      results?: Array<{ person?: GooglePerson }>
    }
    for (const item of data.results ?? []) {
      if (item.person) people.push(item.person)
    }
  } else {
    const body = await searchRes.text().catch(() => '')
    console.error('[contacts] searchContacts failed', searchRes.status, body.slice(0, 300))
    apiFailed = true
  }
  if (otherRes.ok) {
    const data = (await otherRes.json()) as {
      results?: Array<{ person?: GooglePerson }>
    }
    for (const item of data.results ?? []) {
      if (item.person) people.push(item.person)
    }
  } else {
    const body = await otherRes.text().catch(() => '')
    console.error('[contacts] otherContacts:search failed', otherRes.status, body.slice(0, 300))
    if (people.length === 0) apiFailed = true
  }

  console.warn('[contacts] live search', {
    query,
    hits: people.length,
    withPhoto: people.filter((person) => googlePhotoUrl(person)).length,
    apiFailed,
  })
  return { people, insufficientScope: false, apiFailed }
}

/** Live Google search — includes Contacts + Other contacts (email history). */
async function searchGoogleContacts(
  accessToken: string,
  query: string,
): Promise<ContactSearchResult> {
  const results: ContactPerson[] = []
  const seen = new Set<string>()
  const q = query.trim()
  if (!q) return { contacts: [], insufficientScope: false }

  try {
    if (await googleTokenMissingContactsScope(accessToken)) {
      return { contacts: [], insufficientScope: true, apiFailed: false }
    }

    const warmup = await ensureGoogleSearchWarmup(accessToken)
    if (warmup.insufficientScope) {
      return { contacts: [], insufficientScope: true, apiFailed: false }
    }
    if (warmup.apiFailed) {
      return { contacts: [], insufficientScope: false, apiFailed: true }
    }

    let live = await fetchGoogleLiveSearch(accessToken, q)
    if (live.insufficientScope) {
      return { contacts: [], insufficientScope: true, apiFailed: false }
    }

    // Empty after a cold/stale index: force another warmup + one retry.
    if (live.people.length === 0 && !live.apiFailed) {
      const rewarm = await ensureGoogleSearchWarmup(accessToken, { force: true })
      if (rewarm.insufficientScope) {
        return { contacts: [], insufficientScope: true, apiFailed: false }
      }
      live = await fetchGoogleLiveSearch(accessToken, q)
      if (live.insufficientScope) {
        return { contacts: [], insufficientScope: true, apiFailed: false }
      }
    }

    pushGooglePeople(results, seen, live.people)
    return {
      contacts: results,
      insufficientScope: false,
      apiFailed: live.apiFailed && results.length === 0,
    }
  } catch (error) {
    console.error('[contacts] Google contacts search failed:', error)
    return { contacts: [], insufficientScope: false, apiFailed: true }
  }
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

    while (nextUrl && pages < MICROSOFT_DIRECTORY_MAX_PAGES && results.length < MICROSOFT_DIRECTORY_MAX_CONTACTS) {
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
): Promise<{ contacts: ContactPerson[]; needsReconnect: boolean; connected: boolean }> {
  const providers = ['google', 'microsoft'] as const
  const authResults = await Promise.all(
    providers.map(async (provider) => {
      const auth = await getValidAccessToken(userId, provider)
      return { provider, auth }
    }),
  )

  const connected = authResults.some((item) => item.auth)
  const loads = authResults
    .filter((item) => item.auth)
    .map(async (item) => {
      const accessToken = item.auth!.accessToken
      return item.provider === 'google'
        ? loadGoogleDirectory(accessToken)
        : loadMicrosoftDirectory(accessToken)
    })

  if (loads.length === 0) {
    return { contacts: [], needsReconnect: false, connected: false }
  }

  const found = await Promise.all(loads)
  const merged: ContactPerson[] = []
  const seen = new Set<string>()
  let needsReconnect = false

  for (const result of found) {
    if (result.insufficientScope || result.apiFailed) needsReconnect = true
    for (const person of result.contacts) {
      pushUnique(merged, seen, person)
    }
  }

  merged.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
  )

  const withEmail = merged.filter((person) => person.email?.trim()).length
  console.warn('[contacts] directory built', {
    userId: userId.slice(0, 8),
    total: merged.length,
    withEmail,
    needsReconnect: needsReconnect || (connected && withEmail === 0),
    connected,
  })

  return {
    contacts: merged,
    // Prompt reconnect when calendar is linked but Share has nobody with an email.
    needsReconnect: (needsReconnect || (connected && withEmail === 0)) && withEmail === 0,
    connected,
  }
}

async function getCachedDirectory(
  userId: string,
): Promise<{ contacts: ContactPerson[]; needsReconnect: boolean; connected: boolean }> {
  const cached = directoryCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) {
    return {
      contacts: cached.contacts,
      needsReconnect: cached.needsReconnect,
      connected: true,
    }
  }

  const built = await buildDirectory(userId)
  // Don't sticky-cache empty/reconnect states — Share should retry after OAuth.
  if (built.needsReconnect && built.contacts.filter((p) => p.email).length === 0) {
    return built
  }
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
    if (result.insufficientScope || result.apiFailed) needsReconnect = true
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
  googleSearchWarmupAt.clear()
  googleSearchWarmupInFlight.clear()
}

export async function searchConnectedContacts(
  userId: string,
  query: string,
): Promise<{ contacts: ContactPerson[]; needsReconnect: boolean; connected: boolean }> {
  const q = query.trim()

  // Empty query: cached connections directory for Speakers open / prefetch.
  if (!q) {
    const directory = await getCachedDirectory(userId)
    return {
      contacts: filterDirectory(directory.contacts, ''),
      needsReconnect: directory.needsReconnect,
      connected: directory.connected,
    }
  }

  const cacheKey = `${userId}:${q.toLowerCase()}`
  const cachedQuery = queryCache.get(cacheKey)
  if (cachedQuery && cachedQuery.expiresAt > Date.now()) {
    return {
      contacts: cachedQuery.contacts,
      needsReconnect: cachedQuery.needsReconnect,
      connected: true,
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
      (directory.needsReconnect || live.needsReconnect) &&
      merged.filter((person) => person.email?.trim()).length === 0,
    connected: directory.connected,
  }

  // If Google/Microsoft is linked but Share still has zero email hits for this
  // query AND the directory itself is empty of emails, force reconnect.
  const directoryEmails = directory.contacts.filter((person) => person.email?.trim()).length
  if (
    directory.connected &&
    directoryEmails === 0 &&
    result.contacts.filter((person) => person.email?.trim()).length === 0
  ) {
    result.needsReconnect = true
  }

  // Empty misses / reconnect expire quickly so retries pick up immediately.
  if (!(result.needsReconnect && result.contacts.length === 0)) {
    queryCache.set(cacheKey, {
      contacts: result.contacts,
      needsReconnect: result.needsReconnect,
      expiresAt:
        Date.now() + (result.contacts.length === 0 ? EMPTY_DIRECTORY_TTL_MS : QUERY_TTL_MS),
    })
  }

  return result
}
