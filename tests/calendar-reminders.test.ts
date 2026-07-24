import { describe, expect, it } from 'vitest'

import type { CalendarEvent } from '../shared/calendar'
import {
  REMINDER_LEAD_MS,
  reminderEventKey,
  selectReminderEvents,
} from '../electron/calendarReminders'

function event(partial: Partial<CalendarEvent> & { id: string; startAt: string }): CalendarEvent {
  return {
    provider: 'google',
    title: 'Sync',
    endAt: partial.startAt,
    attendees: [],
    meetingUrl: null,
    isOnline: false,
    ...partial,
  }
}

describe('calendar start reminders', () => {
  it('builds a stable event key', () => {
    expect(reminderEventKey({ provider: 'google', id: 'abc' })).toBe('google:abc')
  })

  it('selects events inside the lead window', () => {
    const now = Date.parse('2026-07-23T15:00:00.000Z')
    const due = event({
      id: '1',
      startAt: new Date(now + REMINDER_LEAD_MS - 1000).toISOString(),
    })
    const later = event({
      id: '2',
      startAt: new Date(now + REMINDER_LEAD_MS + 60_000).toISOString(),
    })
    const selected = selectReminderEvents([due, later], now, new Set())
    expect(selected.map((item) => item.id)).toEqual(['1'])
  })

  it('dedupes already notified events', () => {
    const now = Date.parse('2026-07-23T15:00:00.000Z')
    const due = event({
      id: '1',
      startAt: new Date(now + 30_000).toISOString(),
    })
    const notified = new Set([reminderEventKey(due)])
    expect(selectReminderEvents([due], now, notified)).toEqual([])
  })

  it('skips events that started too long ago', () => {
    const now = Date.parse('2026-07-23T15:00:00.000Z')
    const stale = event({
      id: '1',
      startAt: new Date(now - 5 * 60_000).toISOString(),
    })
    expect(selectReminderEvents([stale], now, new Set())).toEqual([])
  })
})
