'use client'

import type { FormEvent } from 'react'

export type ProductivityAction = 'assist' | 'what-to-say' | 'follow-up' | 'recap'

type RecordingSessionCardProps = {
  isRecording: boolean
  query: string
  onQueryChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
  onProductivityAction: (action: ProductivityAction) => void
  screenContextEnabled?: boolean
  loading?: boolean
  reply?: string
  disabled?: boolean
}

const PRODUCTIVITY_ACTIONS: Array<{
  id: ProductivityAction
  label: string
  icon: 'sparkle' | 'wand' | 'chat' | 'recap'
}> = [
  { id: 'assist', label: 'Assist', icon: 'sparkle' },
  { id: 'what-to-say', label: 'What should I say?', icon: 'wand' },
  { id: 'follow-up', label: 'Follow-up questions', icon: 'chat' },
  { id: 'recap', label: 'Recap', icon: 'recap' },
]

function ActionIcon({ type }: { type: (typeof PRODUCTIVITY_ACTIONS)[number]['icon'] }) {
  if (type === 'sparkle') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
      </svg>
    )
  }
  if (type === 'wand') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M15 4l5 5M4 20l4-4M14.5 6.5l3 3M9 11l-4 4M16 3l5 5" />
      </svg>
    )
  }
  if (type === 'chat') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}

export function RecordingSessionCard({
  isRecording,
  query,
  onQueryChange,
  onSubmit,
  onProductivityAction,
  screenContextEnabled = false,
  loading = false,
  reply,
  disabled = false,
}: RecordingSessionCardProps) {
  const placeholder = screenContextEnabled
    ? 'Ask about your screen or conversation, or ⌘↵ for Assist'
    : 'Ask about your conversation, or ⌘↵ for Assist'

  return (
    <div className="session-card">
      {isRecording && (
        <div className="session-card-body">
          <button type="button" className="session-assist-pill" onClick={() => onProductivityAction('assist')}>
            Assist
          </button>

          {screenContextEnabled ? (
            <p className="session-viewed-label">Viewed screen</p>
          ) : null}
          <p className="session-description">
            Clarifi is an AI meeting assistant that listens in real time, understands what&apos;s being said,
            and gives you instant answers, notes, and next steps, all while staying completely undetectable
            on your screen.
          </p>

          <div className="session-productivity-row">
            {PRODUCTIVITY_ACTIONS.map((action, index) => (
              <span key={action.id} className="session-productivity-item">
                {index > 0 ? <span className="session-productivity-dot" aria-hidden>·</span> : null}
                <button
                  type="button"
                  className="session-productivity-chip"
                  onClick={() => onProductivityAction(action.id)}
                  disabled={loading || disabled}
                >
                  <ActionIcon type={action.icon} />
                  <span>{action.label}</span>
                </button>
              </span>
            ))}
          </div>

          {reply ? <p className="session-reply">{reply}</p> : null}
          {loading ? <p className="session-reply session-reply-loading">Thinking…</p> : null}
        </div>
      )}

      <form className="session-composer" onSubmit={onSubmit}>
        <input
          type="text"
          className="session-composer-input session-composer-input-solo"
          placeholder={placeholder}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          disabled={disabled || loading}
        />
      </form>
    </div>
  )
}
