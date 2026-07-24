import { BrowserWindow, Notification } from 'electron'

import type { CalendarEvent } from '../shared/calendar'
import { loadAudioPreferences } from './audioPreferences'
import { fetchCalendarEvents } from './calendarClient'
import { getDeviceCredentials } from './deviceAuth'

/** Lead time before event start to show a reminder (ms). */
export const REMINDER_LEAD_MS = 2 * 60 * 1000
/** How often to poll calendar events while reminders are enabled. */
export const REMINDER_POLL_MS = 30 * 1000
/** Ignore events that started more than this long ago. */
export const REMINDER_LATE_GRACE_MS = 60 * 1000

const notifiedIds = new Set<string>()
let pollTimer: ReturnType<typeof setInterval> | null = null
let getWindow: (() => BrowserWindow | null) | null = null

export function reminderEventKey(event: Pick<CalendarEvent, 'provider' | 'id'>): string {
  return `${event.provider}:${event.id}`
}

/**
 * Returns events that should fire a start reminder for `now`, excluding
 * already-notified keys.
 */
export function selectReminderEvents(
  events: CalendarEvent[],
  nowMs: number,
  alreadyNotified: ReadonlySet<string>,
  leadMs = REMINDER_LEAD_MS,
  lateGraceMs = REMINDER_LATE_GRACE_MS,
): CalendarEvent[] {
  return events.filter((event) => {
    const start = Date.parse(event.startAt)
    if (Number.isNaN(start)) return false
    const key = reminderEventKey(event)
    if (alreadyNotified.has(key)) return false
    const untilStart = start - nowMs
    // Fire when within lead window and not too far past start.
    return untilStart <= leadMs && untilStart >= -lateGraceMs
  })
}

function showReminder(event: CalendarEvent): void {
  const key = reminderEventKey(event)
  notifiedIds.add(key)

  if (!Notification.isSupported()) {
    broadcastReminder(event)
    return
  }

  const notification = new Notification({
    title: 'Meeting starting soon',
    body: `${event.title || 'Untitled meeting'} — Start recording in Clarifi?`,
    silent: false,
  })

  notification.on('click', () => {
    broadcastReminder(event)
  })

  notification.show()
}

function broadcastReminder(event: CalendarEvent): void {
  const win = getWindow?.()
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore()
    win.focus()
    win.webContents.send('calendar:reminder-start', event)
  }
}

async function tick(): Promise<void> {
  if (!loadAudioPreferences().meetingRemindersEnabled) return
  const creds = await getDeviceCredentials()
  if (!creds) return

  const { connected, events } = await fetchCalendarEvents()
  if (!connected || events.length === 0) return

  const due = selectReminderEvents(events, Date.now(), notifiedIds)
  for (const event of due) {
    showReminder(event)
  }

  // Drop stale keys so memory stays bounded (keep recent only).
  if (notifiedIds.size > 200) {
    notifiedIds.clear()
  }
}

export function startCalendarReminders(getMainWindow: () => BrowserWindow | null): void {
  getWindow = getMainWindow
  if (pollTimer) return
  void tick()
  pollTimer = setInterval(() => {
    void tick()
  }, REMINDER_POLL_MS)
}

export function stopCalendarReminders(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

/** Test helper */
export function _resetReminderStateForTests(): void {
  notifiedIds.clear()
  stopCalendarReminders()
}
