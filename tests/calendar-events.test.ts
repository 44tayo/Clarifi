import { describe, expect, it } from 'vitest'

import { googleEventToCalendarEvent } from '../web/src/lib/calendar/google'
import { microsoftEventToCalendarEvent } from '../web/src/lib/calendar/microsoft'

describe('calendar event filtering', () => {
  it('includes multi-person Google events', () => {
    const event = googleEventToCalendarEvent({
      id: 'evt-1',
      summary: 'Product sync',
      start: { dateTime: '2026-07-21T14:00:00Z' },
      end: { dateTime: '2026-07-21T14:30:00Z' },
      attendees: [
        { email: 'me@clarifi.app', self: true, responseStatus: 'accepted' },
        { email: 'alice@example.com', displayName: 'Alice', responseStatus: 'accepted' },
      ],
      hangoutLink: 'https://meet.google.com/abc-defg-hij',
    })

    expect(event).not.toBeNull()
    expect(event?.title).toBe('Product sync')
    expect(event?.isOnline).toBe(true)
    expect(event?.attendees).toHaveLength(2)
  })

  it('skips solo Google events', () => {
    const event = googleEventToCalendarEvent({
      id: 'evt-solo',
      summary: 'Focus block',
      start: { dateTime: '2026-07-21T14:00:00Z' },
      end: { dateTime: '2026-07-21T15:00:00Z' },
      attendees: [{ email: 'me@clarifi.app', self: true, responseStatus: 'accepted' }],
    })

    expect(event).toBeNull()
  })

  it('includes Microsoft events with multiple attendees', () => {
    const event = microsoftEventToCalendarEvent(
      {
        id: 'ms-1',
        subject: 'Weekly standup',
        start: { dateTime: '2026-07-21T09:00:00.0000000' },
        end: { dateTime: '2026-07-21T09:15:00.0000000' },
        attendees: [
          {
            emailAddress: { address: 'me@clarifi.app', name: 'Me' },
            status: { response: 'accepted' },
          },
          {
            emailAddress: { address: 'bob@example.com', name: 'Bob' },
            status: { response: 'accepted' },
          },
        ],
        onlineMeeting: { joinUrl: 'https://teams.microsoft.com/l/meetup-join/abc' },
      },
      'me@clarifi.app',
    )

    expect(event).not.toBeNull()
    expect(event?.provider).toBe('microsoft')
    expect(event?.meetingUrl).toContain('teams.microsoft.com')
  })
})
