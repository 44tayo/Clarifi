import { useEffect, useState } from 'react'

import { EnhancedNotesPanel } from './EnhancedNotesPanel'
import { MeetingMetaBar } from './MeetingMetaBar'
import { NotesEditor } from './NotesEditor'
import { RecordingBar } from './RecordingBar'
import { ShareNotesPanel } from './ShareNotesPanel'
import { TranscriptPanel } from './TranscriptPanel'
import type { useRecording } from '../hooks/useRecording'
import type { Folder, Meeting } from '../types/meeting'

type MeetingWorkspaceProps = {
  meeting: Meeting
  connected: boolean
  plan?: string
  captureMeetingId: string | null
  recording: ReturnType<typeof useRecording>
  folders: Folder[]
  onStartCapture: (meetingId: string) => void
  onUpdate: (patch: { title?: string; userNotes?: string }) => void
  onDelete: () => void
  onEnhance: () => void
  onConnect: () => void
  onOpenDashboard: () => void
  onSetFolders: (folderIds: string[]) => void
  onCreateFolder: (name: string) => Promise<Folder | void> | Folder | void
}

type ReadyTab = 'notes' | 'summary' | 'transcript'

function needsConnectPrompt(meeting: Meeting, connected: boolean): boolean {
  if (connected) return false
  if (meeting.status !== 'error') return false
  const msg = meeting.enhanceError?.toLowerCase() ?? ''
  return msg.includes('connect your account')
}

export function MeetingWorkspace({
  meeting,
  connected,
  plan,
  captureMeetingId,
  recording,
  folders,
  onStartCapture,
  onUpdate,
  onDelete,
  onEnhance,
  onConnect,
  onOpenDashboard,
  onSetFolders,
  onCreateFolder,
}: MeetingWorkspaceProps) {
  const isCapturingThisMeeting = captureMeetingId === meeting.id
  const recordingState = isCapturingThisMeeting ? recording.state : 'idle'
  const recordingActivity = isCapturingThisMeeting ? recording.activity : 'silent'
  const canCapture = meeting.status === 'draft' || meeting.status === 'live'
  const [readyTab, setReadyTab] = useState<ReadyTab>('summary')
  const [connectPromptOpen, setConnectPromptOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const isCapturing = recordingState === 'recording' || recordingState === 'paused'
  const showLiveLayout = (canCapture && isCapturingThisMeeting) || isCapturing
  const showEnhanced =
    meeting.status === 'processing' || meeting.status === 'ready' || meeting.status === 'error'
  const showDraftNotes = canCapture && !showLiveLayout && !showEnhanced
  const canShare = plan === 'pro_plus'

  const transcript = showLiveLayout && isCapturingThisMeeting ? recording.transcript : meeting.transcript

  useEffect(() => {
    const off = window.electronAPI.on('meetings:needs-connect', (payload) => {
      const data = payload as { id?: string }
      if (data.id === meeting.id) {
        setConnectPromptOpen(true)
      }
    })
    return off
  }, [meeting.id])

  useEffect(() => {
    if (needsConnectPrompt(meeting, connected)) {
      setConnectPromptOpen(true)
    }
  }, [meeting, connected])

  useEffect(() => {
    if (connected) {
      setConnectPromptOpen(false)
    }
  }, [connected])

  useEffect(() => {
    if (!connected) return
    if (meeting.status !== 'error') return
    const msg = meeting.enhanceError?.toLowerCase() ?? ''
    if (msg.includes('connect your account')) {
      void onEnhance()
    }
  }, [connected, meeting.status, meeting.enhanceError, onEnhance])

  return (
    <>
      {!connected ? (
        <div className="connect-banner">
          <span>
            Connect your account to unlock AI summaries after meetings. Recording and transcripts
            still work locally.
          </span>
          <button type="button" className="btn btn-secondary" onClick={onConnect}>
            Connect
          </button>
        </div>
      ) : null}

      {connectPromptOpen && !connected ? (
        <div className="connect-modal-backdrop" role="presentation">
          <div className="connect-modal" role="dialog" aria-labelledby="connect-modal-title">
            <h2 id="connect-modal-title">Connect to generate your summary</h2>
            <p>
              Your recording is saved. Sign in to pair this device and Clarifi will create your AI
              summary, decisions, and action items.
            </p>
            <div className="connect-modal-actions">
              <button type="button" className="btn btn-primary" onClick={onConnect}>
                Connect account
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConnectPromptOpen(false)}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <RecordingBar
        meeting={meeting}
        recordingState={recordingState}
        activity={recordingActivity}
        onTitleChange={(title) => onUpdate({ title })}
        onStart={() => onStartCapture(meeting.id)}
        onPause={() => void recording.pause()}
        onResume={() => void recording.resume()}
        onStop={() => void recording.stop()}
        onDelete={onDelete}
      />

      {(showEnhanced || showDraftNotes || showLiveLayout) ? (
        <MeetingMetaBar
          meeting={meeting}
          folders={folders}
          onSetFolders={onSetFolders}
          onCreateFolder={onCreateFolder}
          onShare={() => setShareOpen(true)}
          canShare={canShare}
        />
      ) : null}

      {showLiveLayout && !showEnhanced ? (
        <div className="editor-layout">
          <NotesEditor
            label="My notes"
            value={meeting.userNotes}
            onChange={(userNotes) => onUpdate({ userNotes })}
          />
          <TranscriptPanel
            entries={transcript}
            activity={recordingActivity}
            live={recordingState === 'recording'}
            speakerLabels={meeting.speakerLabels}
          />
        </div>
      ) : null}

      {showDraftNotes ? (
        <div className="editor-layout">
          <NotesEditor
            label="My notes"
            hint="Jot light notes before or after the call. Start recording when you are ready."
            value={meeting.userNotes}
            onChange={(userNotes) => onUpdate({ userNotes })}
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
              {meeting.enhanceError === 'network_error'
                ? 'You appear to be offline. Clarifi will retry when you reconnect.'
                : `Enhancement failed${meeting.enhanceError ? `: ${meeting.enhanceError}` : ''}.`}
              {!connected && needsConnectPrompt(meeting, connected) ? (
                <button type="button" className="link-btn" onClick={onConnect}>
                  Connect account
                </button>
              ) : (
                <button type="button" className="link-btn" onClick={onEnhance}>
                  Try again
                </button>
              )}
            </div>
          ) : null}

          <div className="enhanced-tabs meeting-ready-tabs">
            {(
              [
                { id: 'notes', label: 'My notes' },
                { id: 'summary', label: 'AI Summary' },
                { id: 'transcript', label: 'Transcript' },
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
              <button type="button" className="tab-btn tab-btn-secondary" onClick={onEnhance}>
                Regenerate
              </button>
            ) : null}
          </div>

          {readyTab === 'notes' ? (
            <div className="editor-layout">
              <NotesEditor
                label="My notes"
                hint="Private notes from the call — kept separate from the AI summary."
                value={meeting.userNotes}
                onChange={(userNotes) => onUpdate({ userNotes })}
              />
            </div>
          ) : null}

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
              <TranscriptPanel
                entries={meeting.transcript}
                activity="silent"
                live={false}
                speakerLabels={meeting.speakerLabels}
              />
            </section>
          ) : null}
        </>
      ) : null}

      {shareOpen ? (
        <ShareNotesPanel
          meeting={meeting}
          canShare={canShare}
          onClose={() => setShareOpen(false)}
          onUpgrade={onOpenDashboard}
        />
      ) : null}
    </>
  )
}
