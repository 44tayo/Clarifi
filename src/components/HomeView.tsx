import { useEffect, useMemo, useState } from 'react'

import type { CalendarEvent } from '../../shared/calendar'
import { formatMeetingWhen } from '../lib/format'
import {
  buildUpcomingDayTracker,
  formatEventTimeRange,
  groupMeetingsByDay,
} from '../lib/homeGrouping'
import { CalendarBrandStack } from './icons/CalendarBrandIcons'
import { CalendarConnectModal } from './CalendarConnectModal'
import type { ConnectionStatus, Meeting } from '../types/meeting'

const CALENDAR_CTA_DISMISS_KEY = 'clarifi.home.calendarCtaDismissed'
const TRACKER_DAYS = 7

type HomeViewProps = {
  connection: ConnectionStatus
  calendarConnected: boolean
  calendarLoading: boolean
  calendarEvents: CalendarEvent[]
  meetings: Meeting[]
  selectedId: string | null
  onSelectMeeting: (id: string) => void
  onStartCalendarEvent: (event: CalendarEvent) => void
  onConnectCalendar: (provider: 'google' | 'microsoft') => void
  onConnectAccount: () => void
  onOpenDashboard: () => void
  onNewMeeting: () => void
  isMeetingLocked: (meeting: Meeting) => boolean
}

export function HomeView({
  connection,
  calendarConnected,
  calendarLoading,
  calendarEvents,
  meetings,
  selectedId,
  onSelectMeeting,
  onStartCalendarEvent,
  onConnectCalendar,
  onConnectAccount,
  onOpenDashboard,
  onNewMeeting,
  isMeetingLocked,
}: HomeViewProps) {
  const [ctaDismissed, setCtaDismissed] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    try {
      setCtaDismissed(localStorage.getItem(CALENDAR_CTA_DISMISS_KEY) === '1')
    } catch {
      setCtaDismissed(false)
    }
  }, [])

  const dismissCta = () => {
    setCtaDismissed(true)
    setPickerOpen(false)
    try {
      localStorage.setItem(CALENDAR_CTA_DISMISS_KEY, '1')
    } catch {
      // ignore
    }
  }

  const openPicker = () => setPickerOpen(true)

  const handleConnectProvider = (provider: 'google' | 'microsoft') => {
    setPickerOpen(false)
    onConnectCalendar(provider)
  }

  const showConnectCta =
    connection.paired && !calendarLoading && !calendarConnected && !ctaDismissed

  const dayTracker = useMemo(
    () => buildUpcomingDayTracker(calendarEvents, { days: TRACKER_DAYS }),
    [calendarEvents],
  )

  const recentGroups = useMemo(() => groupMeetingsByDay(meetings, { limit: 16 }), [meetings])

  return (
    <div className="home-view">
      <header className="home-view-header">
        <h1 className="home-view-title">Coming up</h1>
        <button type="button" className="btn btn-primary" onClick={onNewMeeting}>
          + New meeting
        </button>
      </header>

      {!connection.paired ? (
        <section className="home-card home-card-cta">
          <div className="home-card-cta-copy">
            <h2>Sign in to sync your calendar</h2>
            <p>Connect your Clarifi account, then link Google or Outlook to see upcoming meetings here.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={onConnectAccount}>
            Connect account
          </button>
        </section>
      ) : calendarLoading ? (
        <section className="home-card home-schedule">
          <p className="home-muted">Loading calendar…</p>
        </section>
      ) : showConnectCta ? (
        <section className="home-card home-card-cta">
          <div className="home-card-cta-copy">
            <CalendarBrandStack />
            <div>
              <h2>Never miss a meeting</h2>
              <p>
                Connect your calendar to see upcoming meetings, prep notes, and get sharper summaries.
              </p>
            </div>
          </div>
          <div className="home-card-cta-actions">
            <button type="button" className="link-btn" onClick={dismissCta}>
              Dismiss
            </button>
            <button type="button" className="btn btn-primary" onClick={openPicker}>
              Connect calendar
            </button>
          </div>
        </section>
      ) : !calendarConnected ? (
        <section className="home-card home-schedule home-schedule-empty">
          <p>Connect a calendar to see your schedule here.</p>
          <button type="button" className="btn btn-primary" onClick={openPicker}>
            Connect calendar
          </button>
        </section>
      ) : (
        <section className="home-card home-schedule" aria-label="Upcoming schedule">
          <div className="home-day-tracker">
            {dayTracker.map((day) => (
              <div key={day.key} className="home-day-block">
                <h2 className="home-day-label">{day.label}</h2>
                {day.items.length === 0 ? (
                  <p className="home-day-empty">
                    {day.key === dayTracker[0]?.key ? 'No events today.' : 'No events.'}
                  </p>
                ) : (
                  <ul className="home-event-list">
                    {day.items.map((event) => (
                      <li key={`${event.provider}:${event.id}`}>
                        <button
                          type="button"
                          className="home-event-row"
                          onClick={() => onStartCalendarEvent(event)}
                        >
                          <span className="home-event-accent" aria-hidden />
                          <span className="home-event-body">
                            <span className="home-event-title">{event.title || 'Untitled meeting'}</span>
                            <span className="home-event-time">
                              {formatEventTimeRange(event.startAt, event.endAt)}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          {dayTracker.every((day) => day.items.length === 0) ? (
            <button type="button" className="link-btn home-schedule-manage" onClick={openPicker}>
              Manage calendars
            </button>
          ) : null}
        </section>
      )}

      <section className="home-recent">
        <h2 className="home-section-title">Recent</h2>
        {meetings.length === 0 ? (
          <p className="home-muted">No meetings yet. Start one to build your notepad.</p>
        ) : (
          <div className="home-recent-groups">
            {recentGroups.map((group) => (
              <div key={group.key} className="home-recent-group">
                <h3 className="home-recent-day">{group.label}</h3>
                <ul className="home-recent-list">
                  {group.items.map((meeting) => {
                    const locked = isMeetingLocked(meeting)
                    const when = formatMeetingWhen(meeting.startedAt ?? meeting.createdAt)
                    return (
                      <li key={meeting.id}>
                        <button
                          type="button"
                          className={`home-recent-row${meeting.id === selectedId ? ' is-active' : ''}${
                            locked ? ' is-locked' : ''
                          }`}
                          onClick={() =>
                            locked ? onOpenDashboard() : onSelectMeeting(meeting.id)
                          }
                          aria-label={
                            locked
                              ? `${meeting.title} (locked — upgrade to view)`
                              : meeting.title
                          }
                        >
                          <span className="home-recent-title">{meeting.title}</span>
                          <span className="home-recent-meta">
                            {locked ? 'Upgrade to view' : when}
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

      <CalendarConnectModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConnect={handleConnectProvider}
      />
    </div>
  )
}
