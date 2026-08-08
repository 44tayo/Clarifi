import { useCallback, useEffect, useRef, useState } from 'react'

import { EnhancedNotesPanel } from './EnhancedNotesPanel'
import { MeetingAskFloat, type AskSelectionRequest } from './MeetingAskFloat'
import { MeetingDocHeader } from './MeetingDocHeader'
import { MeetingMetaBar, assignFromDisplayName } from './MeetingMetaBar'
import { NotesEditor } from './NotesEditor'
import { RecordingBar } from './RecordingBar'
import { ShareNotesPanel, copyMeetingShareLink } from './ShareNotesPanel'
import { TasksPanel } from './TasksPanel'
import { TranscriptPanel } from './TranscriptPanel'
import { StatefulButton } from './ui/StatefulButton'
import { useToast } from '../hooks/useToast'
import { applySpeakerIdentity } from '../../shared/speakers'
import type { SpeakerIdentity } from '../../shared/speakers'
import type { useRecording } from '../hooks/useRecording'
import type { MeetingTemplateId } from '../../shared/meetingTemplates'
import { applyNoteInsert, undoNoteInsert, type NoteSnapshot } from '../../shared/noteInsertUndo'
import type { Folder, Meeting } from '../types/meeting'

type MeetingWorkspaceProps = {
  meeting: Meeting
  connected: boolean
  plan?: string
  ownerEmail?: string | null
  captureMeetingId: string | null
  recording: ReturnType<typeof useRecording>
  folders: Folder[]
  onStartCapture: (meetingId: string) => void
  onUpdate: (patch: {
    title?: string
    userNotes?: string
    speakerLabels?: Record<string, string>
    speakerIdentities?: Meeting['speakerIdentities']
    actionItems?: string[]
    completedActionItems?: string[]
    enhancedNotes?: string
    evidenceCache?: Record<string, string>
  }) => void
  onDelete: () => void
  onEnhance: () => void
  onConnect: () => void
  onOpenDashboard: () => void
  onSetFolders: (folderIds: string[]) => void
  onCreateFolder: (name: string) => Promise<Folder | void> | Folder | void
  allTags: string[]
  onSetTags: (tags: string[]) => void
  onChangeTemplate: (templateId: MeetingTemplateId) => void
  relatedMeetings?: Meeting[]
  transcriptFocus?: {
    entryId?: string
    audioStartMs?: number
    quote?: string
  } | null
  onTranscriptFocusConsumed?: () => void
}

type ReadyTab = 'summary' | 'transcript' | 'tasks' | 'notes'

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
  ownerEmail,
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
  allTags,
  onSetTags,
  onChangeTemplate,
  relatedMeetings = [],
  transcriptFocus = null,
  onTranscriptFocusConsumed,
}: MeetingWorkspaceProps) {
  const isCapturingThisMeeting = captureMeetingId === meeting.id
  const recordingState = isCapturingThisMeeting ? recording.state : 'idle'
  const recordingActivity = isCapturingThisMeeting ? recording.activity : 'silent'
  const canCapture = meeting.status === 'draft' || meeting.status === 'live'
  const [readyTab, setReadyTab] = useState<ReadyTab>('summary')
  const [connectPromptOpen, setConnectPromptOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareMounted, setShareMounted] = useState(false)
  const [hasSharedWithPeople, setHasSharedWithPeople] = useState(false)
  const [selectionAsk, setSelectionAsk] = useState<AskSelectionRequest | null>(null)
  const [activeHighlight, setActiveHighlight] = useState<{
    entryId?: string
    audioStartMs?: number
    quote?: string
  } | null>(null)
  const [noteUndoStack, setNoteUndoStack] = useState<NoteSnapshot[]>([])
  const sharedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { toast } = useToast()

  const isCapturing = recordingState === 'recording' || recordingState === 'paused'
  const showLiveLayout = (canCapture && isCapturingThisMeeting) || isCapturing
  const showEnhanced =
    meeting.status === 'processing' || meeting.status === 'ready' || meeting.status === 'error'
  const showAskFloat = showEnhanced || showLiveLayout
  const showDraftNotes = canCapture && !showLiveLayout && !showEnhanced
  const canShare = plan === 'pro_plus'

  const transcript = showLiveLayout && isCapturingThisMeeting ? recording.transcript : meeting.transcript

  useEffect(() => {
    if (!transcriptFocus) return
    setReadyTab('transcript')
    setActiveHighlight(transcriptFocus)
    onTranscriptFocusConsumed?.()
  }, [transcriptFocus, onTranscriptFocusConsumed])

  const flashSharedPill = useCallback(() => {
    if (sharedFlashTimerRef.current) clearTimeout(sharedFlashTimerRef.current)
    setHasSharedWithPeople(true)
    sharedFlashTimerRef.current = setTimeout(() => {
      setHasSharedWithPeople(false)
      sharedFlashTimerRef.current = null
    }, 2500)
  }, [])

  useEffect(() => {
    setHasSharedWithPeople(false)
    setShareOpen(false)
    setShareMounted(false)
    if (sharedFlashTimerRef.current) {
      clearTimeout(sharedFlashTimerRef.current)
      sharedFlashTimerRef.current = null
    }
  }, [meeting.id])

  const openShare = useCallback(() => {
    setShareMounted(true)
    setShareOpen(true)
  }, [])

  const closeShare = useCallback(() => {
    setShareOpen(false)
  }, [])

  useEffect(() => {
    return () => {
      if (sharedFlashTimerRef.current) clearTimeout(sharedFlashTimerRef.current)
    }
  }, [])

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

  const assignSpeaker = (speakerKey: string, identity: SpeakerIdentity) => {
    const next = applySpeakerIdentity(
      meeting.speakerIdentities,
      meeting.speakerLabels,
      speakerKey,
      identity,
    )
    onUpdate(next)
    if (identity.source === 'manual' || identity.displayName.trim()) {
      void window.electronAPI.invoke('contacts:upsert', {
        displayName: identity.displayName,
        email: identity.email,
      })
    }
  }

  const renameSpeaker = (speakerKey: string, label: string) => {
    assignSpeaker(speakerKey, assignFromDisplayName(label))
  }

  const toggleTask = (item: string, completed: boolean) => {
    const current = new Set(meeting.completedActionItems ?? [])
    if (completed) current.add(item)
    else current.delete(item)
    onUpdate({ completedActionItems: [...current] })
  }

  const addTask = (item: string) => {
    const next = [...(meeting.actionItems ?? []), item]
    onUpdate({ actionItems: next })
  }

  const handleCopyLink = useCallback(async () => {
    if (!canShare) {
      openShare()
      throw new Error('Sharing requires Pro+')
    }
    const result = await copyMeetingShareLink(meeting.id)
    if (!result.ok) {
      openShare()
      const message =
        result.error === 'plan_required'
          ? 'Sharing requires Pro+'
          : result.error === 'not_authenticated'
            ? 'Connect your account to share'
            : result.error === 'network_error'
              ? 'Offline — try again when connected'
              : 'Could not create share link'
      throw new Error(message)
    }
    toast('Link copied')
  }, [canShare, meeting.id, toast, openShare])

  const handleExport = useCallback(
    async (format: 'markdown' | 'pdf') => {
      const result = (await window.electronAPI.invoke('meetings:export', {
        meetingId: meeting.id,
        format,
      })) as { ok: boolean; error?: string }
      if (result.ok) {
        toast(format === 'pdf' ? 'Exported as PDF' : 'Exported as Markdown')
      } else if (result.error !== 'cancelled') {
        toast('Export failed — try again')
      }
    },
    [meeting.id, toast],
  )

  return (
    <div className={`meeting-workspace${showAskFloat ? ' has-ask-float' : ''}`}>
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

      <div className="meeting-workspace-main">
        {showEnhanced ? (
          <MeetingDocHeader
            meeting={meeting}
            onTitleChange={(title) => onUpdate({ title })}
            onShare={openShare}
            onCopyLink={handleCopyLink}
            onExport={(format) => void handleExport(format)}
            onDelete={onDelete}
            hasSharedWithPeople={hasSharedWithPeople}
          />
        ) : (
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
        )}

        {(showEnhanced || showDraftNotes || showLiveLayout) ? (
          <MeetingMetaBar
            meeting={meeting}
            folders={folders}
            onSetFolders={onSetFolders}
            onCreateFolder={onCreateFolder}
            allTags={allTags}
            onSetTags={onSetTags}
            onAssignSpeaker={assignSpeaker}
            documentLayout={showEnhanced}
            transcriptEntries={transcript}
          />
        ) : null}

        {showLiveLayout && !showEnhanced ? (
          <div className="editor-layout">
            <NotesEditor
              label="Scratchpad"
              value={meeting.userNotes}
              onChange={(userNotes) => onUpdate({ userNotes })}
            />
            <TranscriptPanel
              entries={transcript}
              activity={recordingActivity}
              live={recordingState === 'recording'}
              speakerLabels={meeting.speakerLabels}
              startedAt={meeting.startedAt}
              onRenameSpeaker={renameSpeaker}
              interim={recording.interim}
              highlight={activeHighlight}
            />
          </div>
        ) : null}

        {showDraftNotes ? (
          <div className="editor-layout">
            <NotesEditor
              label="Scratchpad"
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
                  { id: 'summary', label: 'Summary' },
                  { id: 'transcript', label: 'Transcript' },
                  { id: 'tasks', label: 'Tasks' },
                  { id: 'notes', label: 'Scratchpad' },
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
            </div>

            {readyTab === 'summary' ? (
              <EnhancedNotesPanel
                meeting={meeting}
                paired={connected}
                onConnect={onConnect}
                onChangeTemplate={onChangeTemplate}
                onOpenTranscript={() => setReadyTab('transcript')}
                onUpdateNotes={(enhancedNotes) => onUpdate({ enhancedNotes })}
                onCacheEvidence={(claim, summary) => {
                  onUpdate({
                    evidenceCache: {
                      ...(meeting.evidenceCache ?? {}),
                      [claim]: summary,
                    },
                  })
                }}
                onAskWithSelection={(text, mode) => setSelectionAsk({ text, mode })}
              />
            ) : null}

            {readyTab === 'transcript' ? (
              <section className="enhanced-panel artifact-transcript-panel">
                <div className="artifact-reading-column">
                  <div className="artifact-doc-toolbar">
                    <StatefulButton
                      variant="link"
                      idleLabel="Copy transcript"
                      successLabel="Copied"
                      successDuration={1600}
                      className="artifact-doc-copy"
                      icon={
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                          <rect
                            x="5.5"
                            y="5.5"
                            width="7"
                            height="8"
                            rx="1.2"
                            stroke="currentColor"
                            strokeWidth="1.4"
                          />
                          <path
                            d="M10.5 5.5V4.2A1.2 1.2 0 0 0 9.3 3H4.2A1.2 1.2 0 0 0 3 4.2v5.1A1.2 1.2 0 0 0 4.2 10.5H5.5"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                          />
                        </svg>
                      }
                      onClick={async () => {
                        const text = meeting.transcript
                          .map((entry) => {
                            const name =
                              meeting.speakerLabels?.[entry.speaker]?.trim() || entry.speaker
                            return `${name}: ${entry.text}`
                          })
                          .join('\n')
                        await navigator.clipboard.writeText(text)
                      }}
                    />
                  </div>
                  <TranscriptPanel
                    entries={meeting.transcript}
                    activity="silent"
                    live={false}
                    speakerLabels={meeting.speakerLabels}
                    startedAt={meeting.startedAt}
                    onRenameSpeaker={renameSpeaker}
                    hideHeader
                    highlight={activeHighlight}
                  />
                </div>
              </section>
            ) : null}

            {readyTab === 'tasks' ? (
              <div className="artifact-reading-column">
                <TasksPanel meeting={meeting} onToggle={toggleTask} onAdd={addTask} />
              </div>
            ) : null}

            {readyTab === 'notes' ? (
              <div className="editor-layout artifact-scratchpad">
                <div className="artifact-reading-column">
                  <NotesEditor
                    label="Scratchpad"
                    hint="Private notes from the call — kept separate from the AI summary."
                    value={meeting.userNotes}
                    onChange={(userNotes) => onUpdate({ userNotes })}
                  />
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {showAskFloat ? (
        <MeetingAskFloat
          meeting={meeting}
          paired={connected}
          onConnect={onConnect}
          selectionRequest={selectionAsk}
          onSelectionHandled={() => setSelectionAsk(null)}
          onOpenCitation={(citation) => {
            if (citation.meetingId === meeting.id) {
              setReadyTab('transcript')
              setActiveHighlight(citation)
              return
            }
            setReadyTab('transcript')
            setActiveHighlight(citation)
          }}
          onInsertIntoNotes={(text) => {
            const applied = applyNoteInsert(
              {
                enhancedNotes: meeting.enhancedNotes,
                userNotes: meeting.userNotes,
              },
              'enhancedNotes',
              text,
              noteUndoStack,
            )
            setNoteUndoStack(applied.stack)
            onUpdate({ enhancedNotes: applied.next.enhancedNotes })
          }}
          onInsertIntoScratchpad={(text) => {
            const applied = applyNoteInsert(
              {
                enhancedNotes: meeting.enhancedNotes,
                userNotes: meeting.userNotes,
              },
              'userNotes',
              text,
              noteUndoStack,
            )
            setNoteUndoStack(applied.stack)
            onUpdate({ userNotes: applied.next.userNotes })
          }}
          canUndoInsert={noteUndoStack.length > 0}
          relatedMeetings={relatedMeetings}
          onUndoInsert={() => {
            const undone = undoNoteInsert(
              {
                enhancedNotes: meeting.enhancedNotes,
                userNotes: meeting.userNotes,
              },
              noteUndoStack,
            )
            setNoteUndoStack(undone.stack)
            if (!undone.restored) return
            if (undone.restored.target === 'enhancedNotes') {
              onUpdate({ enhancedNotes: undone.next.enhancedNotes })
            } else {
              onUpdate({ userNotes: undone.next.userNotes })
            }
          }}
        />
      ) : null}

      {shareMounted ? (
        <ShareNotesPanel
          key={meeting.id}
          meeting={meeting}
          canShare={canShare}
          ownerEmail={ownerEmail}
          open={shareOpen}
          onClose={closeShare}
          onExited={() => setShareMounted(false)}
          onUpgrade={onOpenDashboard}
          onInviteSent={flashSharedPill}
        />
      ) : null}
    </div>
  )
}
