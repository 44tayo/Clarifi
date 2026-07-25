import {
  getCalendarConnection,
  listCalendarConnections,
  updateAccessToken,
} from './connections'
import { fetchGoogleCalendarEvents } from './google'
import { fetchMicrosoftCalendarEvents } from './microsoft'
import { refreshCalendarAccessToken } from './oauth'
import type { CalendarEvent, CalendarProvider, CalendarStatus } from './types'

const UPCOMING_WINDOW_DAYS = 10

export async function getValidAccessToken(
  userId: string,
  provider: CalendarProvider,
): Promise<{ accessToken: string; accountEmail: string | null } | null> {
  const connection = await getCalendarConnection(userId, provider)
  if (!connection) return null

  const expiresAt = new Date(connection.expires_at).getTime()
  const bufferMs = 60 * 1000

  if (expiresAt > Date.now() + bufferMs) {
    return {
      accessToken: connection.access_token,
      accountEmail: connection.account_email,
    }
  }

  if (!connection.refresh_token) return null

  const refreshed = await refreshCalendarAccessToken(provider, connection.refresh_token)
  if (!refreshed) return null

  await updateAccessToken(
    userId,
    provider,
    refreshed.accessToken,
    refreshed.expiresAt,
    refreshed.refreshToken,
  )

  return {
    accessToken: refreshed.accessToken,
    accountEmail: connection.account_email,
  }
}

export async function getCalendarStatus(userId: string): Promise<CalendarStatus> {
  const connections = await listCalendarConnections(userId)
  const google = connections.find((c) => c.provider === 'google')
  const microsoft = connections.find((c) => c.provider === 'microsoft')

  return {
    connected: Boolean(google || microsoft),
    google: {
      provider: 'google',
      connected: Boolean(google),
      accountEmail: google?.account_email ?? null,
    },
    microsoft: {
      provider: 'microsoft',
      connected: Boolean(microsoft),
      accountEmail: microsoft?.account_email ?? null,
    },
  }
}

export async function fetchUpcomingCalendarEvents(userId: string): Promise<CalendarEvent[]> {
  const now = new Date()
  const timeMax = new Date(now.getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const events: CalendarEvent[] = []

  for (const provider of ['google', 'microsoft'] as const) {
    const auth = await getValidAccessToken(userId, provider)
    if (!auth) continue

    const fetched =
      provider === 'google'
        ? await fetchGoogleCalendarEvents(auth.accessToken, now, timeMax)
        : await fetchMicrosoftCalendarEvents(
            auth.accessToken,
            now,
            timeMax,
            auth.accountEmail,
          )

    events.push(...fetched)
  }

  events.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())

  const seen = new Set<string>()
  return events.filter((event) => {
    const key = `${event.title}:${event.startAt}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function attendeeDisplayNames(event: CalendarEvent): string[] {
  return event.attendees
    .filter((a) => !a.self)
    .map((a) => a.name?.trim() || a.email.split('@')[0] || a.email)
}

export function buildSpeakerHintsFromEvent(
  event: CalendarEvent,
): Record<string, string> {
  const others = event.attendees.filter((a) => !a.self)
  const hints: Record<string, string> = {}

  others.forEach((attendee, index) => {
    const label = `Speaker ${index + 1}`
    hints[label] = attendee.name?.trim() || attendee.email.split('@')[0] || attendee.email
  })

  return hints
}
