export type EntityMeeting = {
  id: string
  title: string
  summary?: string
  enhancedNotes?: string
  userNotes?: string
  attendeeEmails?: string[]
  attendees?: Array<{ name?: string | null; email?: string }>
  startedAt?: number
  createdAt: number
}

function domainFromEmail(email: string): string | null {
  const parts = email.toLowerCase().split('@')
  return parts.length === 2 ? parts[1]! : null
}

function meetingEmails(meeting: EntityMeeting): string[] {
  return [
    ...(meeting.attendeeEmails ?? []),
    ...(meeting.attendees ?? []).map((person) => person.email).filter(Boolean) as string[],
  ].map((email) => email.toLowerCase())
}

export function filterMeetingsByPerson(meetings: EntityMeeting[], personEmail: string): EntityMeeting[] {
  const email = personEmail.trim().toLowerCase()
  if (!email) return []
  return meetings
    .filter((meeting) => meetingEmails(meeting).includes(email))
    .sort((a, b) => (b.startedAt ?? b.createdAt) - (a.startedAt ?? a.createdAt))
}

export function filterMeetingsByCompany(meetings: EntityMeeting[], company: string): EntityMeeting[] {
  const domain = company.trim().toLowerCase()
  if (!domain) return []
  return meetings
    .filter((meeting) =>
      meetingEmails(meeting).some((email) => domainFromEmail(email) === domain),
    )
    .sort((a, b) => (b.startedAt ?? b.createdAt) - (a.startedAt ?? a.createdAt))
}

export function extractKeyQuotes(meeting: EntityMeeting, limit = 3): string[] {
  const source = meeting.enhancedNotes || meeting.summary || meeting.userNotes || ''
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 20)
    .slice(0, limit)
}

export type ScopedChatNav =
  | { scope: 'person'; personEmail: string }
  | { scope: 'company'; company: string }
