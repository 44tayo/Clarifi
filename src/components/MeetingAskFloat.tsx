import { useCallback, useEffect, useRef, useState } from 'react'

import type { ChatEffort } from '../../shared/chatOptions'
import { ChatPromptInput, type ChatPromptSubmit } from './ChatPromptInput'
import { StatefulButton } from './ui/StatefulButton'
import type { Meeting } from '../types/meeting'

export type AskSelectionRequest = {
  text: string
  mode: 'chat' | 'quick-edit'
}

type MeetingAskFloatProps = {
  meeting: Meeting
  paired: boolean
  onConnect: () => void
  selectionRequest?: AskSelectionRequest | null
  onSelectionHandled?: () => void
}

type AskMessage = { id: string; role: 'user' | 'assistant'; text: string }

const FOLLOW_UP_PROMPT =
  'Draft a concise, professional follow-up email based on this meeting. Include a subject line, a short summary, and clear next steps or action items.'

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

function buildSelectionPrompt(req: AskSelectionRequest): string {
  if (req.mode === 'quick-edit') {
    return [
      'Quick-edit the selected note text. Improve clarity and specificity while preserving meaning.',
      'Return only the revised text (no preamble).',
      '',
      'Selected text:',
      req.text,
    ].join('\n')
  }
  return [
    'The user selected this passage from the meeting notes. Answer their next question about it, or explain it using the transcript when helpful.',
    '',
    'Selected text:',
    req.text,
    '',
    'If no further question was given, briefly explain what this means in context of the meeting.',
  ].join('\n')
}

export function MeetingAskFloat({
  meeting,
  paired,
  onConnect,
  selectionRequest,
  onSelectionHandled,
}: MeetingAskFloatProps) {
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<AskMessage[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [selectionChip, setSelectionChip] = useState<string | null>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const sendTextRef = useRef<(text: string) => Promise<void>>(async () => {})

  useEffect(() => {
    if (!expanded) return
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight })
  }, [messages, sending, expanded])

  useEffect(() => {
    if (!expanded) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setExpanded(false)
        setSelectionChip(null)
      }
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [expanded])

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
      setExpanded(true)
      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: display }])
      setDraft('')
      setSending(true)
      setError(null)

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

  sendTextRef.current = async (text: string) => {
    await sendText(text)
  }

  useEffect(() => {
    if (!selectionRequest?.text.trim()) return
    const req = selectionRequest
    setSelectionChip(req.text.trim())
    setExpanded(true)
    if (req.mode === 'quick-edit') {
      void sendTextRef.current(buildSelectionPrompt(req))
    } else {
      setDraft('')
    }
    onSelectionHandled?.()
  }, [selectionRequest, onSelectionHandled])

  const send = useCallback(
    async (payload: ChatPromptSubmit) => {
      const message =
        selectionChip && payload.message.trim()
          ? [
              'Selected text from the notes:',
              selectionChip,
              '',
              'User question:',
              payload.message.trim(),
            ].join('\n')
          : selectionChip && !payload.message.trim()
            ? buildSelectionPrompt({ text: selectionChip, mode: 'chat' })
            : payload.message
      await sendText(
        message,
        payload.images,
        payload.model,
        payload.effort as ChatEffort,
      )
    },
    [selectionChip, sendText],
  )

  return (
    <div ref={rootRef} className={`meeting-ask-float${expanded ? ' is-expanded' : ''}`}>
      {expanded ? (
        <div className="meeting-ask-float-panel">
          <div className="meeting-ask-float-header">
            <span>{selectionChip ? 'Selected text' : 'Ask this meeting'}</span>
            <button
              type="button"
              className="meeting-ask-float-collapse"
              onClick={() => {
                setExpanded(false)
                setSelectionChip(null)
              }}
              aria-label="Collapse chat"
            >
              Close
            </button>
          </div>
          {selectionChip ? (
            <div className="meeting-ask-selection-chip" title={selectionChip}>
              <span className="meeting-ask-selection-label">Selected text</span>
              <span className="meeting-ask-selection-preview">{selectionChip}</span>
              <button
                type="button"
                className="meeting-ask-selection-clear"
                onClick={() => setSelectionChip(null)}
                aria-label="Clear selection"
              >
                ×
              </button>
            </div>
          ) : null}
          <div className="meeting-ask-float-thread" ref={threadRef}>
            {messages.length === 0 && !sending ? (
              <p className="meeting-ask-float-empty">
                {selectionChip ? 'Chat with selected text…' : 'Ask anything about this meeting.'}
              </p>
            ) : null}
            {messages.map((msg) => (
              <div key={msg.id} className={`meeting-ask-bubble meeting-ask-bubble-${msg.role}`}>
                <div className="meeting-ask-bubble-text">{msg.text}</div>
                {msg.role === 'assistant' ? (
                  <StatefulButton
                    variant="link"
                    idleLabel="Copy"
                    successLabel="Copied"
                    successDuration={1400}
                    className="meeting-ask-bubble-copy"
                    onClick={async () => {
                      await navigator.clipboard.writeText(msg.text)
                    }}
                  />
                ) : null}
              </div>
            ))}
            {sending ? (
              <div className="meeting-ask-bubble meeting-ask-bubble-assistant">…</div>
            ) : null}
          </div>
          {error ? <p className="meeting-ask-error">{error}</p> : null}
        </div>
      ) : null}

      <div className="meeting-ask-float-widget">
        <ChatPromptInput
          value={draft}
          onChange={setDraft}
          onSubmit={(payload) => void send(payload)}
          onFocus={() => setExpanded(true)}
          disabled={sending}
          placeholder={selectionChip ? 'Chat with selected text…' : 'Ask this meeting…'}
        />
        <button
          type="button"
          className="meeting-ask-email-link"
          disabled={sending}
          onClick={() => void sendText(FOLLOW_UP_PROMPT)}
        >
          Write follow-up email
        </button>
      </div>
    </div>
  )
}
