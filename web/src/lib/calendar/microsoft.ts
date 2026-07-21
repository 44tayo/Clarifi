import type { CalendarAttendee, CalendarEvent } from './types'

const SKIP_TITLE_PATTERNS = [
  /^focus time$/i,
  /^focus block$/i,
  /^do not disturb$/i,
  /^no meetings?$/i,
  /^out of office$/i,
  /^off work$/i,
  /^ooo$/i,
]

type GraphEvent = {
  id?: string
  subject?: string
  start?: { dateTime?: string; timeZone?: string }
  end?: { dateTime?: string; timeZone?: string }
  isAllDay?: boolean
  isCancelled?: boolean
  showAs?: string
  onlineMeeting?: { joinUrl?: string }
  onlineMeetingUrl?: string
  attendees?: Array<{
    emailAddress?: { address?: string; name?: string }
    status?: { response?: string }
    type?: string
  }>
}

export function parseMicrosoftAttendees(
  attendees: GraphEvent['attendees'],
  organizerEmail?: string | null,
): CalendarAttendee[] {
  const list: CalendarAttendee[] = []

  for (const attendee of attendees ?? []) {
    const email = attendee.emailAddress?.address
    if (!email) continue
    if (attendee.status?.response === 'declined') continue

    list.push({
      email,
      name: attendee.emailAddress?.name ?? null,
      self: organizerEmail ? email.toLowerCase() === organizerEmail.toLowerCase() : false,
    })
  }

  return list
}

export function microsoftEventToCalendarEvent(
  item: GraphEvent,
  selfEmail?: string | null,
): CalendarEvent | null {
  if (!item.id || !item.subject) return null
  if (item.isCancelled) return null
  if (item.showAs === 'free' || item.showAs === 'oof') return null

  const startRaw = item.start?.dateTime
  const endRaw = item.end?.dateTime
  if (!startRaw || !endRaw) return null

  const startAt = new Date(startRaw.endsWith('Z') ? startRaw : `${startRaw}Z`)
  const endAt = new Date(endRaw.endsWith('Z') ? endRaw : `${endRaw}Z`)
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return null

  if (item.isAllDay && endAt.getTime() - startAt.getTime() >= 24 * 60 * 60 * 1000) {
    return null
  }

  if (SKIP_TITLE_PATTERNS.some((pattern) => pattern.test(item.subject!.trim()))) {
    return null
  }

  const attendees = parseMicrosoftAttendees(item.attendees, selfEmail)
  if (attendees.length < 2) return null

  const meetingUrl = item.onlineMeeting?.joinUrl ?? item.onlineMeetingUrl ?? null

  return {
    id: item.id,
    provider: 'microsoft',
    title: item.subject.trim(),
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    attendees,
    meetingUrl,
    isOnline: Boolean(meetingUrl),
  }
}

export async function fetchMicrosoftCalendarEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date,
  selfEmail?: string | null,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    startDateTime: timeMin.toISOString(),
    endDateTime: timeMax.toISOString(),
    $orderby: 'start/dateTime',
    $top: '50',
  })

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    },
  )

  if (!response.ok) {
    console.error('Microsoft Calendar events fetch failed:', response.status)
    return []
  }

  const data = (await response.json()) as { value?: GraphEvent[] }
  const events: CalendarEvent[] = []

  for (const item of data.value ?? []) {
    const parsed = microsoftEventToCalendarEvent(item, selfEmail)
    if (parsed) events.push(parsed)
  }

  return events
}
