import type { Meeting } from '../types/meeting'

type MeetingDocHeaderProps = {
  meeting: Meeting
  onTitleChange: (title: string) => void
  onBackToMeetings: () => void
  onShare: () => void
  onDelete: () => void
}

export function MeetingDocHeader({
  meeting,
  onTitleChange,
  onBackToMeetings,
  onShare,
  onDelete,
}: MeetingDocHeaderProps) {
  return (
    <header className="meeting-doc-header">
      <div className="meeting-doc-top">
        <nav className="meeting-breadcrumb" aria-label="Breadcrumb">
          <button type="button" className="meeting-breadcrumb-link" onClick={onBackToMeetings}>
            Meetings
          </button>
          <span className="meeting-breadcrumb-sep" aria-hidden>
            ›
          </span>
          <span className="meeting-breadcrumb-current">{meeting.title || 'Untitled'}</span>
        </nav>
        <div className="meeting-doc-actions">
          <button type="button" className="btn btn-secondary" onClick={onShare}>
            Share
          </button>
          <button type="button" className="btn btn-secondary" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
      <input
        className="meeting-doc-title"
        value={meeting.title}
        onChange={(event) => onTitleChange(event.target.value)}
        aria-label="Meeting title"
      />
    </header>
  )
}
