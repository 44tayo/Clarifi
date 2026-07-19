import { EnhancedNotesPanel } from './EnhancedNotesPanel'
import { NotesEditor } from './NotesEditor'
import { RecordingBar } from './RecordingBar'
import { TranscriptPanel } from './TranscriptPanel'
import { useRecording } from '../hooks/useRecording'
import type { Meeting } from '../types/meeting'

type MeetingWorkspaceProps = {
  meeting: Meeting
  connected: boolean
  onUpdate: (patch: { title?: string; userNotes?: string }) => void
  onDelete: () => void
  onEnhance: () => void
  onConnect: () => void
}

export function MeetingWorkspace({
  meeting,
  connected,
  onUpdate,
  onDelete,
  onEnhance,
  onConnect,
}: MeetingWorkspaceProps) {
  const canCapture = meeting.status === 'draft' || meeting.status === 'live'
  const recording = useRecording(canCapture ? meeting.id : null)

  const isCapturing = recording.state === 'recording' || recording.state === 'paused'
  const showLiveLayout = canCapture || isCapturing
  const showEnhanced =
    meeting.status === 'processing' || meeting.status === 'ready' || meeting.status === 'error'

  const transcript = showLiveLayout ? recording.transcript : meeting.transcript

  return (
    <>
      {!connected ? (
        <div className="connect-banner">
          <span>Connect your account to enhance notes with AI after meetings.</span>
          <button type="button" className="btn btn-secondary" onClick={onConnect}>
            Connect
          </button>
        </div>
      ) : null}

      <RecordingBar
        meeting={meeting}
        recordingState={recording.state}
        activity={recording.activity}
        onTitleChange={(title) => onUpdate({ title })}
        onStart={() => void recording.start()}
        onPause={() => void recording.pause()}
        onResume={() => void recording.resume()}
        onStop={() => void recording.stop()}
        onDelete={onDelete}
      />

      {showLiveLayout && !showEnhanced ? (
        <div className="editor-layout">
          <NotesEditor
            value={meeting.userNotes}
            onChange={(userNotes) => onUpdate({ userNotes })}
          />
          <TranscriptPanel
            entries={transcript}
            activity={recording.activity}
            live={recording.state === 'recording'}
          />
        </div>
      ) : null}

      {showEnhanced ? (
        <>
          {meeting.status === 'processing' ? (
            <div className="editor-layout">
              <NotesEditor value={meeting.userNotes} onChange={() => undefined} readOnly />
              <TranscriptPanel entries={meeting.transcript} activity="silent" live={false} />
            </div>
          ) : null}
          <EnhancedNotesPanel meeting={meeting} onRegenerate={onEnhance} />
        </>
      ) : null}
    </>
  )
}
