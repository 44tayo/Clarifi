import { useMemo, useState } from 'react'

import type { CalendarEvent, CalendarStatus } from '../../shared/calendar'
import { formatMeetingWhen } from '../lib/format'
import {
  formatEventTimeRange,
  groupMeetingsByDay,
} from '../lib/homeGrouping'
import { CalendarConnectModal } from './CalendarConnectModal'
import { HomeChatOverlay } from './HomeChatOverlay'
import type { ConnectionStatus, Meeting } from '../types/meeting'

const UPCOMING_LIMIT = 8

type HomeViewProps = {
  connection: ConnectionStatus
  calendarConnected: boolean
  calendarStatus: CalendarStatus
  calendarLoading: boolean
  calendarEvents: CalendarEvent[]
  meetings: Meeting[]
  selectedId: string | null
  onSelectMeeting: (id: string) => void
  onStartCalendarEvent: (event: CalendarEvent) => void
  onConnectCalendar: (provider: 'google' | 'microsoft') => void
  onConnectAccount: () => void
  onOpenDashboard: () => void
  onOpenChat?: () => void
  onOpenSettings?: () => void
  isMeetingLocked: (meeting: Meeting) => boolean
}

function todayChip(now = new Date()) {
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(now)
  const day = new Intl.DateTimeFormat(undefined, { day: 'numeric' }).format(now)
  const month = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(now)
  return `${weekday} ${day} ${month}`
}

function upcomingEvents(events: CalendarEvent[], now = new Date()): CalendarEvent[] {
  const nowMs = now.getTime()
  return [...events]
    .filter((event) => {
      const end = Date.parse(event.endAt)
      const start = Date.parse(event.startAt)
      if (Number.isNaN(start)) return false
      if (!Number.isNaN(end)) return end >= nowMs
      return start >= nowMs - 60_000
    })
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
    .slice(0, UPCOMING_LIMIT)
}

export function HomeView({
  connection,
  calendarConnected,
  calendarStatus,
  calendarLoading,
  calendarEvents,
  meetings,
  selectedId,
  onSelectMeeting,
  onStartCalendarEvent,
  onConnectCalendar,
  onConnectAccount,
  onOpenDashboard,
  onOpenChat,
  onOpenSettings,
  isMeetingLocked,
}: HomeViewProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const openPicker = () => setPickerOpen(true)

  const handleConnectProvider = (provider: 'google' | 'microsoft') => {
    onConnectCalendar(provider)
  }

  const dateChip = useMemo(() => todayChip(), [])
  const upcoming = useMemo(() => upcomingEvents(calendarEvents), [calendarEvents])
  const recentGroups = useMemo(() => groupMeetingsByDay(meetings, { limit: 16 }), [meetings])

  return (
    <div className="home-view">
      <div className="home-view-scroll">
        <section className="home-coming-up" aria-label="Coming up">
          <header className="home-coming-header">
            <h2 className="home-coming-title">Coming up</h2>
            <span className="home-coming-sep" aria-hidden>
              |
            </span>
            <time className="home-coming-date-chip" dateTime={new Date().toISOString().slice(0, 10)}>
              {dateChip}
            </time>
          </header>

          <div className="home-agenda">
            {!connection.paired ? (
              <div className="home-agenda-empty">
                <p className="home-agenda-empty-copy">
                  Connect Clarifi to link a calendar and see what’s next.
                </p>
                <button type="button" className="btn btn-secondary" onClick={onConnectAccount}>
                  Connect account
                </button>
              </div>
            ) : calendarLoading ? (
              <div className="home-agenda-empty">
                <p className="home-agenda-empty-copy">Loading calendar…</p>
              </div>
            ) : !calendarConnected ? (
              <div className="home-agenda-empty">
                <p className="home-agenda-empty-copy">Link a calendar to see what’s next.</p>
                <button type="button" className="btn btn-secondary" onClick={openPicker}>
                  Connect calendar
                </button>
              </div>
            ) : upcoming.length === 0 ? (
              <div className="home-agenda-empty">
                <p className="home-agenda-empty-copy">Nothing on the calendar right now.</p>
                <button type="button" className="link-btn" onClick={openPicker}>
                  Calendar settings
                </button>
              </div>
            ) : (
              <ul className="home-upcoming-list">
                {upcoming.map((event, index) => (
                  <li key={`${event.provider}:${event.id}`}>
                    <button
                      type="button"
                      className={`home-upcoming-row${index === 0 ? ' is-next' : ''}`}
                      onClick={() => onStartCalendarEvent(event)}
                    >
                      <span className="home-upcoming-time">
                        {formatEventTimeRange(event.startAt, event.endAt)}
                      </span>
                      <span className="home-upcoming-title">
                        {event.title || 'Untitled meeting'}
                      </span>
                      <span className="home-upcoming-chevron" aria-hidden>
                        ›
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="home-recent" aria-label="Past meetings">
          {meetings.length === 0 ? (
            <p className="home-muted">No meetings yet. Start one to build your notepad.</p>
          ) : (
            <div className="home-recent-groups">
              {recentGroups.map((group) => (
                <div key={group.key} className="home-recent-group">
                  <h2 className="home-recent-day">{group.label}</h2>
                  <ul className="home-recent-list">
                    {group.items.map((meeting) => {
                      const locked = isMeetingLocked(meeting)
                      const when = formatMeetingWhen(meeting.startedAt ?? meeting.createdAt)
                      return (
                        <li key={meeting.id}>
                          <button
                            type="button"
                            className={`home-recent-row${
                              meeting.id === selectedId ? ' is-active' : ''
                            }${locked ? ' is-locked' : ''}`}
                            onClick={() =>
                              locked ? onOpenDashboard() : onSelectMeeting(meeting.id)
                            }
                            aria-label={
                              locked
                                ? `${meeting.title} (locked — upgrade to view)`
                                : meeting.title
                            }
                          >
                            <span className="home-recent-icon" aria-hidden>
                              <NoteGlyph />
                            </span>
                            <span className="home-recent-body">
                              <span className="home-recent-title">{meeting.title}</span>
                              <span className="home-recent-sub">Me</span>
                            </span>
                            <span className="home-recent-meta">
                              {locked ? 'Upgrade' : when}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <HomeChatOverlay
        paired={connection.paired}
        onConnect={onConnectAccount}
        onOpenChatView={onOpenChat}
      />

      <CalendarConnectModal
        open={pickerOpen}
        google={calendarStatus.google}
        microsoft={calendarStatus.microsoft}
        onClose={() => setPickerOpen(false)}
        onConnect={handleConnectProvider}
        onOpenSettings={
          onOpenSettings
            ? () => {
                setPickerOpen(false)
                onOpenSettings()
              }
            : undefined
        }
      />
    </div>
  )
}

function NoteGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 2.5h7l2 2v9a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path d="M10.5 2.5V5h2.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  )
}
