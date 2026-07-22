import { MeetingRow } from './MeetingRow'
import type { ConnectionStatus, Meeting } from '../types/meeting'

type MeetingsListViewProps = {
  title: string
  subtitle?: string
  meetings: Meeting[]
  selectedId: string | null
  connection: ConnectionStatus
  onSelectMeeting: (id: string) => void
  onOpenDashboard: () => void
  onNewMeeting: () => void
  isMeetingLocked: (meeting: Meeting) => boolean
}

export function MeetingsListView({
  title,
  subtitle,
  meetings,
  selectedId,
  onSelectMeeting,
  onOpenDashboard,
  onNewMeeting,
  isMeetingLocked,
}: MeetingsListViewProps) {
  return (
    <div className="meetings-list-view">
      <header className="home-view-header">
        <div>
          <h1 className="home-view-title">{title}</h1>
          {subtitle ? <p className="home-view-subtitle">{subtitle}</p> : null}
        </div>
        <button type="button" className="btn btn-primary" onClick={onNewMeeting}>
          + New meeting
        </button>
      </header>

      <div className="meetings-list-body">
        {meetings.length === 0 ? (
          <p className="home-muted">No meetings in this list yet.</p>
        ) : (
          meetings.map((meeting) => {
            const locked = isMeetingLocked(meeting)
            return (
              <MeetingRow
                key={meeting.id}
                meeting={meeting}
                active={meeting.id === selectedId}
                locked={locked}
                onSelect={locked ? () => onOpenDashboard() : onSelectMeeting}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
