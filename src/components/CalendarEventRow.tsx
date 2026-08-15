import type { CalendarEvent } from '../../shared/calendar'
import { attendeeSummary, formatEventTime } from '../hooks/useCalendar'

type CalendarEventRowProps = {
  event: CalendarEvent
  active?: boolean
  onStart: (event: CalendarEvent) => void
}

export function CalendarEventRow({ event, active, onStart }: CalendarEventRowProps) {
  const attendees = attendeeSummary(event)

  return (
    <button
      type="button"
      className={`sidebar-calendar-row${active ? ' sidebar-calendar-row-active' : ''}`}
      onClick={() => onStart(event)}
    >
      <span className="sidebar-calendar-time">{formatEventTime(event.startAt)}</span>
      <span className="sidebar-calendar-title">{event.title}</span>
      {attendees ? <span className="sidebar-calendar-meta">{attendees}</span> : null}
    </button>
  )
}
