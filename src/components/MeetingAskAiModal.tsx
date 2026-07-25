import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { ChatEffort } from '../../shared/chatOptions'
import { ChatPromptInput, type ChatPromptSubmit } from './ChatPromptInput'
import type { Meeting } from '../types/meeting'

type MeetingAskAiModalProps = {
  meeting: Meeting
  paired: boolean
  onConnect: () => void
  onClose: () => void
}

type AskMessage = { id: string; role: 'user' | 'assistant'; text: string }

type Starter = {
  id: string
  label: string
  prompt: string
  kind: 'sparkle' | 'question'
}

const STARTERS: Starter[] = [
  {
    id: 'follow-up',
    label: 'Draft a follow-up email',
    prompt:
      'Draft a concise, professional follow-up email based on this meeting. Include a subject line, a short summary, and clear next steps or action items.',
    kind: 'sparkle',
  },
  {
    id: 'takeaways',
    label: 'What were the key takeaways?',
    prompt: 'What were the key takeaways from this meeting?',
    kind: 'question',
  },
  {
    id: 'decisions',
    label: 'Which decisions were made during the meeting?',
    prompt: 'Which decisions were made during the meeting?',
    kind: 'question',
  },
  {
    id: 'problems',
    label: 'Which problems surfaced?',
    prompt: 'Which problems or risks surfaced during the meeting?',
    kind: 'question',
  },
]

function errorMessage(code: string): string {
  switch (code) {
    case 'network_error':
      return 'You appear offline. Try again when you reconnect.'
    case 'auth_expired':
    case 'not_authenticated':
      return 'Connect your account to ask Clarifi.'
    case 'plan_required':
      return 'Your plan does not include this chat option. Upgrade to Pro for premium models.'
    case 'rate_limit':
      return 'Too many requests — wait a moment and try again.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

export function MeetingAskAiModal({ meeting, paired, onConnect, onClose }: MeetingAskAiModalProps) {
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<AskMessage[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [maximized, setMaximized] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<AskMessage[][]>([])
  const [hoveredStarter, setHoveredStarter] = useState<string | null>(STARTERS[0]?.id ?? null)
  const threadRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    document.body.classList.add('has-modal-open')
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('has-modal-open')
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight })
  }, [messages, sending])

  const startNewChat = useCallback(() => {
    if (messages.length > 0) {
      setHistory((prev) => [messages, ...prev].slice(0, 12))
    }
    setMessages([])
    setDraft('')
    setError(null)
    setShowHistory(false)
  }, [messages])

  const sendText = useCallback(
    async (text: string, images: ChatPromptSubmit['images'] = [], model?: string, effort?: ChatEffort) => {
      const trimmed = text.trim()
      if ((!trimmed && images.length === 0) || sending) return
      if (!paired) {
        setError('Connect your account to ask Clarifi.')
        onConnect()
        return
      }

      const display =
        images.length > 0
          ? `${trimmed}${trimmed ? '\n' : ''}[${images.length} image${
              images.length === 1 ? '' : 's'
            } attached]`
          : trimmed
      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: display }])
      setDraft('')
      setSending(true)
      setError(null)
      setShowHistory(false)

      try {
        const result = (await window.electronAPI.invoke('chat:send', {
          message: trimmed,
          meetingId: meeting.id,
          scope: 'meeting',
          model,
          effort,
          images,
        })) as { reply?: string; error?: string }

        if (result.error) {
          setError(errorMessage(result.error))
          return
        }
        if (!result.reply) {
          setError(errorMessage('chat_failed'))
          return
        }
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', text: result.reply! },
        ])
      } catch {
        setError(errorMessage('chat_failed'))
      } finally {
        setSending(false)
      }
    },
    [meeting.id, onConnect, paired, sending],
  )

  const send = useCallback(
    async (payload: ChatPromptSubmit) => {
      await sendText(
        payload.message,
        payload.images,
        payload.model,
        payload.effort as ChatEffort,
      )
    },
    [sendText],
  )

  const hasThread = messages.length > 0

  const panel = (
    <div
      className={`meeting-ask-ai-overlay${maximized ? ' is-maximized' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Ask AI"
      onClick={onClose}
    >
      <div
        className={`meeting-ask-ai-modal${maximized ? ' is-maximized' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="meeting-ask-ai-header">
          <h2>{hasThread ? 'Chat' : 'New chat'}</h2>
          <div className="meeting-ask-ai-header-actions">
            <button
              type="button"
              className="meeting-ask-ai-icon-btn"
              onClick={() => setShowHistory((v) => !v)}
              aria-label="Chat history"
              title="Chat history"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
                <path
                  d="M8 5v3.2l2 1.3"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="meeting-ask-ai-icon-btn"
              onClick={() => setMaximized((v) => !v)}
              aria-label={maximized ? 'Shrink chat' : 'Maximize chat'}
              title={maximized ? 'Shrink chat' : 'Maximize chat'}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M9.5 3H13v3.5M6.5 13H3V9.5M13 9.5V13H9.5M3 6.5V3h3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="meeting-ask-ai-icon-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {showHistory ? (
          <div className="meeting-ask-ai-history">
            <button type="button" className="meeting-ask-ai-starter" onClick={startNewChat}>
              <span className="meeting-ask-ai-starter-icon" aria-hidden>
                +
              </span>
              <span>New chat</span>
            </button>
            {history.length === 0 ? (
              <p className="meeting-ask-ai-history-empty">No earlier chats for this meeting yet.</p>
            ) : (
              history.map((thread, index) => {
                const preview = thread.find((m) => m.role === 'user')?.text ?? 'Chat'
                return (
                  <button
                    key={`h-${index}`}
                    type="button"
                    className="meeting-ask-ai-starter"
                    onClick={() => {
                      setMessages(thread)
                      setShowHistory(false)
                    }}
                  >
                    <span className="meeting-ask-ai-starter-icon" aria-hidden>
                      ↻
                    </span>
                    <span className="meeting-ask-ai-history-preview">{preview}</span>
                  </button>
                )
              })
            )}
          </div>
        ) : !hasThread ? (
          <div className="meeting-ask-ai-starters">
            {STARTERS.map((starter) => (
              <button
                key={starter.id}
                type="button"
                className={`meeting-ask-ai-starter${
                  hoveredStarter === starter.id ? ' is-hovered' : ''
                }`}
                onMouseEnter={() => setHoveredStarter(starter.id)}
                onFocus={() => setHoveredStarter(starter.id)}
                onClick={() => void sendText(starter.prompt)}
                disabled={sending}
              >
                <span className="meeting-ask-ai-starter-icon" aria-hidden>
                  {starter.kind === 'sparkle' ? (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M8 1.5 9.2 5.8 13.5 7 9.2 8.2 8 12.5 6.8 8.2 2.5 7l4.3-1.2L8 1.5Z"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M3 4.5h10v7.2a1 1 0 0 1-1 1H6.2L3 15V4.5Z"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M7.2 7.2h.01M8.8 7.2c0-.9-.7-1.4-1.6-1.4S5.6 6.3 5.6 7.2c0 .7.4 1.1 1.1 1.4l.5.2v.7"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </span>
                <span>{starter.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="meeting-ask-ai-thread" ref={threadRef}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`meeting-ask-ai-bubble meeting-ask-ai-bubble-${msg.role}`}
              >
                {msg.text}
              </div>
            ))}
            {sending ? (
              <div className="meeting-ask-ai-bubble meeting-ask-ai-bubble-assistant">…</div>
            ) : null}
          </div>
        )}

        {error ? <p className="meeting-ask-ai-error">{error}</p> : null}

        <div className="meeting-ask-ai-composer">
          <ChatPromptInput
            value={draft}
            onChange={setDraft}
            onSubmit={(payload) => void send(payload)}
            disabled={sending}
            placeholder="Write a message…"
            autoFocus
          />
          <div className="meeting-ask-ai-composer-meta">
            <span>In current meeting</span>
          </div>
        </div>

        <p className="meeting-ask-ai-disclaimer">
          Clarifi is AI and can make mistakes. Please double-check responses.
        </p>
      </div>
    </div>
  )

  return createPortal(panel, document.body)
}
