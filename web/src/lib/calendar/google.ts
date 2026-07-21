import type { CalendarAttendee, CalendarEvent } from './types'

const SKIP_TITLE_PATTERNS = [
  /^focus time$/i,
  /^focus block$/i,
  /^do not disturb$/i,
  /^no meetings?$/i,
  /^out of office$/i,
  /^off work$/i,
  /^ooo$/i,
  /^working location$/i,
]

type GoogleEvent = {
  id?: string
  summary?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  attendees?: Array<{
    email?: string
    displayName?: string
    self?: boolean
    responseStatus?: string
  }>
  hangoutLink?: string
  conferenceData?: { entryPoints?: Array<{ uri?: string; entryPointType?: string }> }
  status?: string
  eventType?: string
}

export function parseGoogleAttendees(
  attendees: GoogleEvent['attendees'],
): CalendarAttendee[] {
  if (!attendees) return []
  return attendees
    .filter((a) => a.email && a.responseStatus !== 'declined')
    .map((a) => ({
      email: a.email!,
      name: a.displayName ?? null,
      self: Boolean(a.self),
    }))
}

export function googleEventToCalendarEvent(item: GoogleEvent): CalendarEvent | null {
  if (!item.id || !item.summary) return null
  if (item.status === 'cancelled') return null

  const eventType = item.eventType ?? 'default'
  if (eventType === 'focusTime' || eventType === 'outOfOffice' || eventType === 'workingLocation') {
    return null
  }

  const startRaw = item.start?.dateTime ?? item.start?.date
  const endRaw = item.end?.dateTime ?? item.end?.date
  if (!startRaw || !endRaw) return null

  const startAt = new Date(startRaw)
  const endAt = new Date(endRaw)
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return null

  const isAllDay = Boolean(item.start?.date && !item.start?.dateTime)
  if (isAllDay && endAt.getTime() - startAt.getTime() >= 24 * 60 * 60 * 1000) {
    return null
  }

  if (SKIP_TITLE_PATTERNS.some((pattern) => pattern.test(item.summary!.trim()))) {
    return null
  }

  const attendees = parseGoogleAttendees(item.attendees)
  const participantCount = attendees.length > 0 ? attendees.length : 1
  if (participantCount < 2) return null

  let meetingUrl: string | null = item.hangoutLink ?? null
  if (!meetingUrl && item.conferenceData?.entryPoints) {
    const video = item.conferenceData.entryPoints.find(
      (entry) => entry.entryPointType === 'video' && entry.uri,
    )
    meetingUrl = video?.uri ?? null
  }

  return {
    id: item.id,
    provider: 'google',
    title: item.summary.trim(),
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    attendees,
    meetingUrl,
    isOnline: Boolean(meetingUrl),
  }
}

export async function fetchGoogleCalendarEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  })

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  if (!response.ok) {
    console.error('Google Calendar events fetch failed:', response.status)
    return []
  }

  const data = (await response.json()) as { items?: GoogleEvent[] }
  const events: CalendarEvent[] = []

  for (const item of data.items ?? []) {
    const parsed = googleEventToCalendarEvent(item)
    if (parsed) events.push(parsed)
  }

  return events
}
