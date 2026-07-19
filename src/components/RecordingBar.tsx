import { durationLabel } from '../lib/format'
import type { Meeting, RecordingState } from '../types/meeting'

type RecordingBarProps = {
  meeting: Meeting
  recordingState: RecordingState
  activity: string
  onTitleChange: (title: string) => void
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onDelete: () => void
}

export function RecordingBar({
  meeting,
  recordingState,
  activity,
  onTitleChange,
  onStart,
  onPause,
  onResume,
  onStop,
  onDelete,
}: RecordingBarProps) {
  const duration = durationLabel(meeting.startedAt, meeting.endedAt)
  const isLive = recordingState === 'recording' || meeting.status === 'live'

  return (
    <header className="recording-bar">
      <div className="recording-bar-left">
        <span className={`recording-indicator${isLive ? ' is-live' : ''}`}>
          {isLive ? '● Recording' : statusCopy(meeting.status, recordingState)}
          {duration ? ` · ${duration}` : ''}
          {isLive ? ` · ${activity}` : ''}
        </span>
        <input
          className="recording-title-input"
          value={meeting.title}
          onChange={(event) => onTitleChange(event.target.value)}
          aria-label="Meeting title"
        />
      </div>
      <div className="recording-bar-actions">
        {recordingState === 'idle' && meeting.status !== 'live' ? (
          <button type="button" className="btn btn-primary" onClick={onStart}>
            Start capture
          </button>
        ) : null}
        {recordingState === 'recording' ? (
          <>
            <button type="button" className="btn btn-secondary" onClick={onPause}>
              Pause
            </button>
            <button type="button" className="btn btn-danger" onClick={onStop}>
              End meeting
            </button>
          </>
        ) : null}
        {recordingState === 'paused' ? (
          <>
            <button type="button" className="btn btn-primary" onClick={onResume}>
              Resume
            </button>
            <button type="button" className="btn btn-danger" onClick={onStop}>
              End meeting
            </button>
          </>
        ) : null}
        {recordingState === 'idle' && (meeting.status === 'draft' || meeting.status === 'ready' || meeting.status === 'error') ? (
          <button type="button" className="btn btn-secondary" onClick={onDelete}>
            Delete
          </button>
        ) : null}
      </div>
    </header>
  )
}

function statusCopy(status: Meeting['status'], recordingState: RecordingState): string {
  if (recordingState === 'paused') return 'Paused'
  if (status === 'processing') return 'Enhancing notes'
  if (status === 'ready') return 'Notes ready'
  if (status === 'error') return 'Enhancement failed'
  return 'Draft'
}
