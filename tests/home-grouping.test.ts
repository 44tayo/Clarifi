import { describe, expect, it } from 'vitest'

import type { CalendarEvent } from '../shared/calendar'
import type { Meeting } from '../src/types/meeting'
import {
  buildUpcomingDayTracker,
  formatEventTimeRange,
  groupMeetingsByDay,
} from '../src/lib/homeGrouping'

function event(partial: Partial<CalendarEvent> & Pick<CalendarEvent, 'id' | 'startAt' | 'endAt'>): CalendarEvent {
  return {
    provider: 'google',
    title: 'Meeting',
    attendees: [],
    meetingUrl: null,
    isOnline: false,
    ...partial,
  }
}

describe('homeGrouping', () => {
  it('builds a date tracker with today and stretches through the last event day', () => {
    const now = new Date('2026-07-21T10:00:00')
    const tracker = buildUpcomingDayTracker(
      [
        event({
          id: '1',
          title: 'trading',
          startAt: '2026-07-22T17:30:00',
          endAt: '2026-07-22T18:30:00',
        }),
      ],
      { days: 7, now },
    )

    expect(tracker).toHaveLength(2)
    expect(tracker[0].items).toHaveLength(0)
    expect(tracker[1].items[0]?.title).toBe('trading')
    expect(formatEventTimeRange('2026-07-22T17:30:00', '2026-07-22T18:30:00')).toMatch(/17:30|5:30/)
  })

  it('shows only today when there are no upcoming events', () => {
    const now = new Date('2026-07-21T10:00:00')
    const tracker = buildUpcomingDayTracker([], { days: 7, now })
    expect(tracker).toHaveLength(1)
    expect(tracker[0].items).toHaveLength(0)
  })

  it('groups recent meetings by local day', () => {
    const now = new Date('2026-07-21T20:00:00')
    const meetings = [
      {
        id: 'a',
        title: 'Today note',
        status: 'ready',
        createdAt: new Date('2026-07-21T12:00:00').getTime(),
        startedAt: new Date('2026-07-21T12:00:00').getTime(),
        userNotes: '',
        transcript: [],
        folderIds: [],
      },
      {
        id: 'b',
        title: 'Older note',
        status: 'ready',
        createdAt: new Date('2026-07-08T19:00:00').getTime(),
        startedAt: new Date('2026-07-08T19:00:00').getTime(),
        userNotes: '',
        transcript: [],
        folderIds: [],
      },
    ] as Meeting[]

    const groups = groupMeetingsByDay(meetings, { now })
    expect(groups).toHaveLength(2)
    expect(groups[0].label).toBe('Today')
    expect(groups[0].items[0]?.id).toBe('a')
    expect(groups[1].items[0]?.id).toBe('b')
  })
})
