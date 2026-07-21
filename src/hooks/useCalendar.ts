import { useCallback, useEffect, useState } from 'react'

import type { CalendarEvent, CalendarStatus } from '../../shared/calendar'

const POLL_MS = 5 * 60 * 1000

const EMPTY_STATUS: CalendarStatus = {
  connected: false,
  google: { provider: 'google', connected: false, accountEmail: null },
  microsoft: { provider: 'microsoft', connected: false, accountEmail: null },
}

export function useCalendar(enabled: boolean) {
  const [status, setStatus] = useState<CalendarStatus>(EMPTY_STATUS)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setStatus(EMPTY_STATUS)
      setEvents([])
      setLoading(false)
      return
    }

    try {
      const [nextStatus, nextEvents] = await Promise.all([
        window.electronAPI.invoke('calendar:status') as Promise<CalendarStatus>,
        window.electronAPI.invoke('calendar:events') as Promise<{
          connected: boolean
          events: CalendarEvent[]
        }>,
      ])
      setStatus(nextStatus ?? EMPTY_STATUS)
      setEvents(Array.isArray(nextEvents?.events) ? nextEvents.events : [])
    } catch {
      setStatus(EMPTY_STATUS)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void refresh()
    if (!enabled) return undefined

    const timer = window.setInterval(() => {
      void refresh()
    }, POLL_MS)

    return () => window.clearInterval(timer)
  }, [enabled, refresh])

  const openConnect = useCallback(async (provider: 'google' | 'microsoft') => {
    await window.electronAPI.invoke('calendar:open-connect', provider)
  }, [])

  return {
    status,
    events,
    loading,
    refresh,
    openConnect,
  }
}

export function formatEventTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (sameDay) {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function attendeeSummary(event: CalendarEvent): string {
  const names = event.attendees
    .filter((person) => !person.self)
    .map((person) => person.name?.trim() || person.email.split('@')[0] || person.email)
  if (names.length === 0) return ''
  if (names.length <= 2) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`
}

export function speakerHintsFromEvent(event: CalendarEvent): Record<string, string> {
  const others = event.attendees.filter((person) => !person.self)
  const hints: Record<string, string> = {}
  others.forEach((person, index) => {
    hints[`Speaker ${index + 1}`] =
      person.name?.trim() || person.email.split('@')[0] || person.email
  })
  return hints
}
