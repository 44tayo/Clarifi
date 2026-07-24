import { useCallback, useEffect, useRef, useState } from 'react'

import type { ChatEffort } from '../../shared/chatOptions'
import { ChatPromptInput, type ChatPromptSubmit } from './ChatPromptInput'
import type { Meeting } from '../types/meeting'

type MeetingAskBarProps = {
  meeting: Meeting
  paired: boolean
  onConnect: () => void
}

type AskMessage = { id: string; role: 'user' | 'assistant'; text: string }

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

function buildFollowUpEmail(meeting: Meeting): { subject: string; body: string } {
  const subject = `Follow-up: ${meeting.title}`
  const lines = [
    `Hi,`,
    ``,
    `Quick follow-up from our meeting “${meeting.title}”.`,
    ``,
  ]
  if (meeting.summary) {
    lines.push(meeting.summary.trim(), ``)
  }
  if (meeting.actionItems && meeting.actionItems.length > 0) {
    lines.push(`Action items:`)
    for (const item of meeting.actionItems) {
      lines.push(`- ${item}`)
    }
    lines.push(``)
  }
  lines.push(`Best,`)
  return { subject, body: lines.join('\n') }
}

export function MeetingAskBar({ meeting, paired, onConnect }: MeetingAskBarProps) {
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<AskMessage[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [emailCopied, setEmailCopied] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages([])
    setDraft('')
    setError(null)
    setOpen(false)
  }, [meeting.id])

  useEffect(() => {
    if (!open) return
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight })
  }, [messages, sending, open])

  const writeFollowUp = useCallback(async () => {
    const { subject, body } = buildFollowUpEmail(meeting)
    const full = `Subject: ${subject}\n\n${body}`
    await navigator.clipboard.writeText(full)
    setEmailCopied(true)
    window.setTimeout(() => setEmailCopied(false), 1800)
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(mailto, '_blank')
  }, [meeting])

  const send = useCallback(
    async (payload: ChatPromptSubmit) => {
      const text = payload.message.trim()
      if ((!text && payload.images.length === 0) || sending) return
      if (!paired) {
        setError('Connect your account to ask Clarifi.')
        setOpen(true)
        onConnect()
        return
      }

      setOpen(true)
      const display =
        payload.images.length > 0
          ? `${text}${text ? '\n' : ''}[${payload.images.length} image${
              payload.images.length === 1 ? '' : 's'
            } attached]`
          : text
      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: display }])
      setDraft('')
      setSending(true)
      setError(null)

      try {
        const result = (await window.electronAPI.invoke('chat:send', {
          message: text,
          meetingId: meeting.id,
          scope: 'meeting',
          model: payload.model,
          effort: payload.effort as ChatEffort,
          images: payload.images,
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

  return (
    <div className={`meeting-ask-bar${open ? ' is-open' : ''}`}>
      {open && messages.length > 0 ? (
        <div className="meeting-ask-thread" ref={threadRef}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`meeting-ask-bubble meeting-ask-bubble-${msg.role}`}
            >
              {msg.text}
            </div>
          ))}
          {sending ? <div className="meeting-ask-bubble meeting-ask-bubble-assistant">…</div> : null}
        </div>
      ) : null}
      {error ? <p className="meeting-ask-error">{error}</p> : null}
      <div className="meeting-ask-row">
        <div className="meeting-ask-input-wrap">
          <ChatPromptInput
            value={draft}
            onChange={setDraft}
            onSubmit={(payload) => void send(payload)}
            disabled={sending}
            placeholder="Ask this meeting…"
          />
        </div>
        <button type="button" className="btn btn-secondary meeting-ask-email" onClick={() => void writeFollowUp()}>
          {emailCopied ? 'Copied' : 'Write follow-up email'}
        </button>
      </div>
    </div>
  )
}
