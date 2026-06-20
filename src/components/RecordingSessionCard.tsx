'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'

export type SessionBodyView = 'assist' | 'transcript'

export type SessionTranscriptEntry = {
  id: string
  text: string
  source: 'mic' | 'system'
  speaker: string
  at: number
}

export type SessionAssistAction = {
  kind: string
  label: string
  speakable: string
  context?: string
}

type RecordingSessionCardProps = {
  isRecording: boolean
  isPaused?: boolean
  query: string
  onQueryChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
  screenContextEnabled?: boolean
  loading?: boolean
  reply?: string
  disabled?: boolean
  isDictating?: boolean
  dictationLoading?: boolean
  onDictationToggle?: () => void
  dictationDisabled?: boolean
  dictationBlockedReason?: string
  transcript?: SessionTranscriptEntry[]
  transcriptionActivity?: 'silent' | 'listening' | 'transcribing'
  liveActions?: SessionAssistAction[]
  assistError?: string
  onRecap?: () => void
}

function formatTranscriptTime(at: number): string {
  const d = new Date(at)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

const TOOL_SLOTS = [
  {
    id: 'answer',
    title: 'Answer',
    hint: 'Questions in your audio',
    icon: '❓',
    tone: 'answer',
    kinds: ['product_info', 'objection'] as string[],
  },
  {
    id: 'define',
    title: 'Define',
    hint: 'Acronyms & key terms',
    icon: '📘',
    tone: 'define',
    kinds: ['technical_lookup'] as string[],
  },
  {
    id: 'speak',
    title: 'What should I say?',
    hint: 'When they finish speaking',
    icon: '✦',
    tone: 'speak',
    kinds: ['speak_now', 'next_step'] as string[],
  },
  {
    id: 'follow-up',
    title: 'Follow-up',
    hint: 'Discovery & pain points',
    icon: '💬',
    tone: 'follow-up',
    kinds: ['discovery'] as string[],
  },
]

function findActionForSlot(
  actions: SessionAssistAction[],
  kinds: string[],
): SessionAssistAction | null {
  for (let i = actions.length - 1; i >= 0; i--) {
    if (kinds.includes(actions[i].kind)) return actions[i]
  }
  return null
}

function ComposerMicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  )
}

function SessionViewSwitch({
  view,
  onChange,
}: {
  view: SessionBodyView
  onChange: (view: SessionBodyView) => void
}) {
  return (
    <div className="session-view-switch" role="tablist" aria-label="Session panel">
      <button
        type="button"
        role="tab"
        aria-selected={view === 'assist'}
        className={`session-view-switch-btn ${view === 'assist' ? 'active' : ''}`}
        onClick={() => onChange('assist')}
      >
        Assist
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === 'transcript'}
        className={`session-view-switch-btn ${view === 'transcript' ? 'active' : ''}`}
        onClick={() => onChange('transcript')}
      >
        Transcript
      </button>
    </div>
  )
}

function LiveTranscriptPanel({
  entries,
  isPaused,
  activity,
}: {
  entries: SessionTranscriptEntry[]
  isPaused: boolean
  activity: 'silent' | 'listening' | 'transcribing'
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [entries.length, entries[entries.length - 1]?.id])

  const statusLabel = isPaused
    ? 'Paused'
    : activity === 'transcribing'
      ? 'Transcribing…'
      : activity === 'silent'
        ? 'Waiting for speech…'
        : 'Listening…'

  return (
    <div className="session-transcript-panel session-panel-content">
      <div className="live-transcript-header">
        <span className="expanded-label">Live transcript</span>
        <span className="live-transcript-meta">{entries.length} lines</span>
      </div>
      <div ref={scrollRef} className="live-transcript-primary session-transcript-scroll">
        {entries.length === 0 ? (
          <div className={`transcript-feed-empty ${isPaused ? 'transcript-feed-paused' : ''}`}>
            <div className="transcript-feed-status">
              {!isPaused && activity !== 'silent' ? (
                <span className="transcript-feed-pulse" aria-hidden />
              ) : null}
              <span>{statusLabel}</span>
            </div>
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="transcript-feed-row">
              <span className="transcript-feed-time">{formatTranscriptTime(entry.at)}</span>
              <div className="transcript-feed-body">
                <span className="transcript-feed-speaker">{entry.speaker}</span>
                <span className="transcript-feed-text">{entry.text}</span>
              </div>
            </div>
          ))
        )}
        {entries.length > 0 && !isPaused ? (
          <div className="transcript-feed-status session-transcript-status">
            {activity === 'transcribing' ? <span className="transcript-feed-pulse" aria-hidden /> : null}
            <span>{statusLabel}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ToolSlotRow({
  title,
  hint,
  icon,
  tone,
  action,
  expanded,
  onToggle,
}: {
  title: string
  hint: string
  icon: string
  tone: string
  action: SessionAssistAction | null
  expanded: boolean
  onToggle: () => void
}) {
  const isLive = action !== null
  const subtitle = action?.label ?? hint

  return (
    <div
      className={`session-tool-slot tone-${tone} ${isLive ? 'session-tool-slot--live' : 'session-tool-slot--waiting'} ${expanded ? 'session-tool-slot--expanded' : ''}`}
    >
      <button
        type="button"
        className="session-tool-slot-btn"
        onClick={isLive ? onToggle : undefined}
        disabled={!isLive}
        aria-expanded={isLive ? expanded : undefined}
      >
        <span className="session-tool-slot-accent" aria-hidden />
        <span className="session-tool-slot-icon" aria-hidden>
          {icon}
        </span>
        <span className="session-tool-slot-copy">
          <span className="session-tool-slot-title">{title}</span>
          <span className="session-tool-slot-hint">{subtitle}</span>
        </span>
        <span className={`session-tool-slot-status ${isLive ? 'is-live' : ''}`}>
          {isLive ? 'Live' : 'Waiting'}
        </span>
      </button>
      {isLive && expanded ? (
        <div className="session-tool-slot-body">
          <p className="sales-assist-speakable">{action.speakable}</p>
          {action.context ? <p className="sales-assist-context">{action.context}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

function AssistPanel({
  screenContextEnabled,
  loading,
  reply,
  liveActions,
  assistError,
  onRecap,
}: {
  screenContextEnabled: boolean
  loading: boolean
  reply?: string
  liveActions: SessionAssistAction[]
  assistError?: string
  onRecap?: () => void
}) {
  const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null)

  useEffect(() => {
    if (liveActions.length === 0) {
      setExpandedSlotId(null)
      return
    }
    const latest = liveActions[liveActions.length - 1]
    const slot = TOOL_SLOTS.find((s) => s.kinds.includes(latest.kind))
    if (slot) setExpandedSlotId(slot.id)
  }, [liveActions])

  return (
    <div className="session-panel-content session-assist-panel">
      {screenContextEnabled ? <p className="session-viewed-label">Viewed screen</p> : null}

      {assistError ? <p className="session-assist-error">{assistError}</p> : null}

      <div className="session-tool-rail" role="list" aria-label="Assist tools">
        {TOOL_SLOTS.map((slot) => {
          const action = findActionForSlot(liveActions, slot.kinds)
          return (
            <ToolSlotRow
              key={slot.id}
              title={slot.title}
              hint={slot.hint}
              icon={slot.icon}
              tone={slot.tone}
              action={action}
              expanded={expandedSlotId === slot.id}
              onToggle={() =>
                setExpandedSlotId(expandedSlotId === slot.id ? null : slot.id)
              }
            />
          )
        })}
      </div>

      {reply ? <p className="session-reply">{reply}</p> : null}
      {loading ? <p className="session-reply session-reply-loading">Thinking…</p> : null}

      {onRecap ? (
        <button type="button" className="session-recap-link" onClick={onRecap} disabled={loading}>
          Recap so far
        </button>
      ) : null}
    </div>
  )
}

export function RecordingSessionCard({
  isRecording,
  isPaused = false,
  query,
  onQueryChange,
  onSubmit,
  screenContextEnabled = false,
  loading = false,
  reply,
  disabled = false,
  isDictating = false,
  dictationLoading = false,
  onDictationToggle,
  dictationDisabled = false,
  dictationBlockedReason,
  transcript = [],
  transcriptionActivity = 'listening',
  liveActions = [],
  assistError,
  onRecap,
}: RecordingSessionCardProps) {
  const [bodyView, setBodyView] = useState<SessionBodyView>('assist')

  useEffect(() => {
    if (!isRecording) {
      setBodyView('assist')
    }
  }, [isRecording])

  const placeholder = screenContextEnabled
    ? 'Ask or search anything about my screen'
    : 'Ask or search anything'

  const micLabel = dictationLoading
    ? 'Transcribing…'
    : isDictating
      ? 'Stop dictation'
      : dictationBlockedReason
        ? dictationBlockedReason
        : 'Speak into chat'

  return (
    <div className="session-card">
      {isRecording && (
        <div className="session-card-body">
          <SessionViewSwitch view={bodyView} onChange={setBodyView} />

          {bodyView === 'transcript' ? (
            <LiveTranscriptPanel
              entries={transcript}
              isPaused={isPaused}
              activity={transcriptionActivity}
            />
          ) : (
            <AssistPanel
              screenContextEnabled={screenContextEnabled}
              loading={loading}
              reply={reply}
              liveActions={liveActions}
              assistError={assistError}
              onRecap={onRecap}
            />
          )}
        </div>
      )}

      <form className="session-composer" onSubmit={onSubmit}>
        <div className="session-composer-row">
          <input
            type="text"
            className="session-composer-input"
            placeholder={placeholder}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            disabled={disabled || loading || dictationLoading}
          />
          <button
            type="button"
            className={`session-composer-mic ${isDictating ? 'active' : ''} ${dictationLoading ? 'loading' : ''}`}
            onClick={onDictationToggle}
            disabled={disabled || dictationDisabled || dictationLoading || !onDictationToggle}
            aria-label={micLabel}
            title={dictationBlockedReason ?? micLabel}
            aria-pressed={isDictating}
          >
            {dictationLoading ? (
              <span className="session-composer-mic-spinner" aria-hidden />
            ) : (
              <ComposerMicIcon />
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
