import { useState } from 'react'

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

type ReadyTab = 'summary' | 'transcript' | 'scratchpad'

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
  const [readyTab, setReadyTab] = useState<ReadyTab>('summary')

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
            label="Scratchpad"
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
            <div className="processing-banner">Enhancing your notes with AI…</div>
          ) : null}

          {meeting.status === 'error' ? (
            <div className="processing-banner processing-banner-error">
              Enhancement failed{meeting.enhanceError ? `: ${meeting.enhanceError}` : ''}.
              <button type="button" className="link-btn" onClick={onEnhance}>
                Try again
              </button>
            </div>
          ) : null}

          <div className="enhanced-tabs meeting-ready-tabs">
            {(
              [
                { id: 'summary', label: 'Summary' },
                { id: 'transcript', label: 'Transcript' },
                { id: 'scratchpad', label: 'Scratchpad' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`tab-btn${readyTab === tab.id ? ' is-active' : ''}`}
                onClick={() => setReadyTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
            {meeting.status === 'ready' || meeting.status === 'error' ? (
              <button type="button" className="tab-btn" onClick={onEnhance}>
                Regenerate
              </button>
            ) : null}
          </div>

          {readyTab === 'summary' ? (
            <EnhancedNotesPanel meeting={meeting} onRegenerate={onEnhance} />
          ) : null}

          {readyTab === 'transcript' ? (
            <section className="enhanced-panel">
              <div className="enhanced-panel-toolbar">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const text = meeting.transcript
                      .map((entry) => `${entry.speaker}: ${entry.text}`)
                      .join('\n')
                    void navigator.clipboard.writeText(text)
                  }}
                >
                  Copy transcript
                </button>
              </div>
              <TranscriptPanel entries={meeting.transcript} activity="silent" live={false} />
            </section>
          ) : null}

          {readyTab === 'scratchpad' ? (
            <div className="editor-layout">
              <NotesEditor
                label="Scratchpad"
                hint="Private notes from the call — kept separate from the AI summary."
                value={meeting.userNotes}
                onChange={(userNotes) => onUpdate({ userNotes })}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </>
  )
}
