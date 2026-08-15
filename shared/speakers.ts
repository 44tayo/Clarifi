export type SpeakerIdentitySource = 'calendar' | 'manual' | 'contact'

export type SpeakerIdentity = {
  displayName: string
  email?: string
  source: SpeakerIdentitySource
}

export type MeetingAttendee = {
  email: string
  name: string | null
  self?: boolean
}

export type SpeakerIdentities = Record<string, SpeakerIdentity>

const AVATAR_PALETTE = [
  '#5b6cff',
  '#c47a3a',
  '#3d9b7a',
  '#b45a8c',
  '#4a8fb8',
  '#9a6b3f',
  '#6b7c93',
  '#8b5cf6',
]

export function speakerInitials(name: string): string {
  const cleaned = name.trim()
  if (!cleaned) return '?'
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  }
  return cleaned.slice(0, 2).toUpperCase()
}

export function speakerAvatarColor(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]!
}

export function displayNameForSpeaker(
  speakerKey: string,
  identities?: SpeakerIdentities | null,
  labels?: Record<string, string> | null,
): string {
  const identity = identities?.[speakerKey]
  if (identity?.displayName?.trim()) return identity.displayName.trim()
  const label = labels?.[speakerKey]?.trim()
  if (label) return label
  return speakerKey
}

export function emailForSpeaker(
  speakerKey: string,
  identities?: SpeakerIdentities | null,
): string | undefined {
  const email = identities?.[speakerKey]?.email?.trim()
  return email || undefined
}

export function isSpeakerIdentified(
  speakerKey: string,
  identities?: SpeakerIdentities | null,
  labels?: Record<string, string> | null,
): boolean {
  const name = displayNameForSpeaker(speakerKey, identities, labels)
  if (!name || name === speakerKey) return false
  if (/^speaker\s+\d+$/i.test(name)) return false
  if (name === 'Them' || name === 'Me') return speakerKey === 'Me'
  return true
}

export function labelsFromIdentities(identities: SpeakerIdentities): Record<string, string> {
  const labels: Record<string, string> = {}
  for (const [key, identity] of Object.entries(identities)) {
    if (identity.displayName.trim()) labels[key] = identity.displayName.trim()
  }
  return labels
}

/** Merge legacy string labels into identity map (name only). */
export function identitiesFromLabels(
  labels: Record<string, string> | undefined,
  existing?: SpeakerIdentities,
): SpeakerIdentities {
  const next: SpeakerIdentities = { ...(existing ?? {}) }
  for (const [key, value] of Object.entries(labels ?? {})) {
    const displayName = value.trim()
    if (!displayName) continue
    if (next[key]?.displayName === displayName) continue
    next[key] = {
      displayName,
      email: next[key]?.email,
      source: next[key]?.source ?? 'manual',
    }
  }
  return next
}

export function applySpeakerIdentity(
  identities: SpeakerIdentities | undefined,
  labels: Record<string, string> | undefined,
  speakerKey: string,
  identity: SpeakerIdentity,
): { speakerIdentities: SpeakerIdentities; speakerLabels: Record<string, string> } {
  const speakerIdentities: SpeakerIdentities = {
    ...(identities ?? {}),
    [speakerKey]: {
      displayName: identity.displayName.trim(),
      email: identity.email?.trim() || undefined,
      source: identity.source,
    },
  }
  const speakerLabels: Record<string, string> = {
    ...(labels ?? {}),
    [speakerKey]: identity.displayName.trim(),
  }
  return { speakerIdentities, speakerLabels }
}

export function meetingAttendeesFromCalendar(
  attendees: Array<{ email: string; name: string | null; self?: boolean }>,
): MeetingAttendee[] {
  return attendees
    .map((person) => ({
      email: person.email.trim(),
      name: person.name?.trim() || null,
      self: Boolean(person.self),
    }))
    .filter((person) => Boolean(person.email))
}

export function candidatePeopleFromMeeting(input: {
  attendees?: MeetingAttendee[] | null
  attendeeEmails?: string[] | null
  speakerIdentities?: SpeakerIdentities | null
}): Array<{ displayName: string; email?: string; source: SpeakerIdentitySource }> {
  const byEmail = new Map<string, { displayName: string; email?: string; source: SpeakerIdentitySource }>()

  for (const attendee of input.attendees ?? []) {
    if (attendee.self) continue
    const email = attendee.email.trim().toLowerCase()
    if (!email) continue
    const displayName = attendee.name?.trim() || email.split('@')[0] || email
    byEmail.set(email, { displayName, email: attendee.email.trim(), source: 'calendar' })
  }

  for (const raw of input.attendeeEmails ?? []) {
    const email = raw.trim().toLowerCase()
    if (!email || byEmail.has(email)) continue
    byEmail.set(email, {
      displayName: email.split('@')[0] || email,
      email: raw.trim(),
      source: 'calendar',
    })
  }

  for (const identity of Object.values(input.speakerIdentities ?? {})) {
    const email = identity.email?.trim().toLowerCase()
    if (email && !byEmail.has(email)) {
      byEmail.set(email, {
        displayName: identity.displayName,
        email: identity.email,
        source: identity.source,
      })
    }
  }

  return [...byEmail.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
  )
}

export function filterPeopleCandidates(
  people: Array<{ displayName: string; email?: string; source: SpeakerIdentitySource }>,
  query: string,
): Array<{ displayName: string; email?: string; source: SpeakerIdentitySource }> {
  const q = query.trim().toLowerCase()
  if (!q) return people
  return people.filter((person) => {
    const name = person.displayName.toLowerCase()
    const email = person.email?.toLowerCase() ?? ''
    return name.includes(q) || email.includes(q)
  })
}

/** Prefer contacts with an email address ahead of name-only entries. */
export function contactsWithEmailFirst<T extends { email?: string }>(people: T[]): T[] {
  const withEmail: T[] = []
  const without: T[] = []
  for (const person of people) {
    if (person.email?.trim()) withEmail.push(person)
    else without.push(person)
  }
  return [...withEmail, ...without]
}

export function speakerPillSummary(
  speakerKeys: string[],
  identities?: SpeakerIdentities | null,
  labels?: Record<string, string> | null,
): string {
  const names = speakerKeys
    .map((key) => displayNameForSpeaker(key, identities, labels))
    .map((name) => name.split(/\s+/)[0] ?? name)
  if (names.length === 0) return 'Speakers'
  if (names.length <= 2) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`
}
