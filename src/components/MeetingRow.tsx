import { formatMeetingWhen, statusLabel } from '../lib/format'
import { beginMeetingDrag, endMeetingDrag } from '../lib/meetingDragPreview'
import type { Meeting } from '../types/meeting'

type MeetingRowProps = {
  meeting: Meeting
  active: boolean
  locked?: boolean
  onSelect: (id: string) => void
}

export function MeetingRow({ meeting, active, locked = false, onSelect }: MeetingRowProps) {
  const when = formatMeetingWhen(meeting.startedAt ?? meeting.createdAt)

  return (
    <button
      type="button"
      className={`meeting-row${active ? ' is-active' : ''}${locked ? ' is-locked' : ''}`}
      draggable={!locked}
      onDragStart={(event) => {
        if (locked) {
          event.preventDefault()
          return
        }
        beginMeetingDrag(event, meeting.id, meeting.title)
      }}
      onDragEnd={() => endMeetingDrag()}
      onClick={() => onSelect(meeting.id)}
      aria-label={locked ? `${meeting.title} (locked — upgrade to view)` : meeting.title}
      title={locked ? undefined : 'Drag onto a folder in the sidebar'}
    >
      <span className="meeting-row-title">{meeting.title}</span>
      <span className="meeting-row-meta">
        {locked ? (
          <span className="meeting-row-lock">🔒 Upgrade to view</span>
        ) : (
          <>
            <span className={`status-dot ${meeting.status}`} aria-hidden="true" />
            <span>{statusLabel(meeting.status)}</span>
          </>
        )}
        <span>·</span>
        <span>{when}</span>
      </span>
    </button>
  )
}
