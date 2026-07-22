import type { CalendarEvent } from '../../shared/calendar'
import type { Meeting } from '../types/meeting'

export type DayBucket<T> = {
  key: string
  label: string
  date: Date
  items: T[]
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function dayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function formatDayHeader(date: Date, now = new Date()): string {
  const day = startOfLocalDay(date)
  const today = startOfLocalDay(now)
  const tomorrow = addDays(today, 1)

  if (day.getTime() === today.getTime()) return 'Today'
  if (day.getTime() === tomorrow.getTime()) return 'Tomorrow'

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(day)
}

export function formatScheduleDayLabel(date: Date, now = new Date()): string {
  const day = startOfLocalDay(date)
  const today = startOfLocalDay(now)
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(day)
  const monthDay = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
  }).format(day)

  if (day.getTime() === today.getTime()) {
    return `${monthDay} (${weekday})`
  }

  return `${monthDay} (${weekday})`
}

export function formatEventTimeRange(startAt: string, endAt: string): string {
  const start = new Date(startAt)
  const end = new Date(endAt)
  if (Number.isNaN(start.getTime())) return ''

  const timeFmt = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })

  if (Number.isNaN(end.getTime())) return timeFmt.format(start)
  return `${timeFmt.format(start)} – ${timeFmt.format(end)}`
}

/** Build a fixed date tracker window (default 7 days) and place events into each day. */
export function buildUpcomingDayTracker(
  events: CalendarEvent[],
  options?: { days?: number; now?: Date },
): DayBucket<CalendarEvent>[] {
  const days = options?.days ?? 7
  const now = options?.now ?? new Date()
  const today = startOfLocalDay(now)

  const byDay = new Map<string, CalendarEvent[]>()
  for (const event of events) {
    const start = new Date(event.startAt)
    if (Number.isNaN(start.getTime())) continue
    if (start.getTime() < today.getTime()) continue
    const key = dayKey(start)
    const list = byDay.get(key) ?? []
    list.push(event)
    byDay.set(key, list)
  }

  const buckets: DayBucket<CalendarEvent>[] = []
  for (let i = 0; i < days; i += 1) {
    const date = addDays(today, i)
    const key = dayKey(date)
    const items = (byDay.get(key) ?? []).slice().sort((a, b) => {
      return new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    })
    buckets.push({
      key,
      label: formatScheduleDayLabel(date, now),
      date,
      items,
    })
  }

  let lastWithItems = 0
  for (let i = 0; i < buckets.length; i += 1) {
    if (buckets[i].items.length > 0) lastWithItems = i
  }

  // Always show today. Stretch through the last day that has a meeting.
  if (buckets[0]?.items.length === 0 && lastWithItems === 0) {
    return buckets.slice(0, 1)
  }
  return buckets.slice(0, lastWithItems + 1)
}

export function groupMeetingsByDay(
  meetings: Meeting[],
  options?: { now?: Date; limit?: number },
): DayBucket<Meeting>[] {
  const now = options?.now ?? new Date()
  const limit = options?.limit ?? 20
  const sliced = meetings.slice(0, limit)

  const order: string[] = []
  const byDay = new Map<string, Meeting[]>()

  for (const meeting of sliced) {
    const at = meeting.startedAt ?? meeting.createdAt
    const date = startOfLocalDay(new Date(at))
    const key = dayKey(date)
    if (!byDay.has(key)) {
      byDay.set(key, [])
      order.push(key)
    }
    byDay.get(key)!.push(meeting)
  }

  return order.map((key) => {
    const items = byDay.get(key)!
    const date = startOfLocalDay(new Date(items[0].startedAt ?? items[0].createdAt))
    return {
      key,
      label: formatDayHeader(date, now),
      date,
      items,
    }
  })
}
