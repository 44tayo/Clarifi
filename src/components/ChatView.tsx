import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { Meeting } from '../types/meeting'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

type ChatViewProps = {
  meetings: Meeting[]
  paired: boolean
  onConnect: () => void
  onOpenMeeting: (id: string) => void
}

function errorMessage(code: string): string {
  switch (code) {
    case 'network_error':
      return 'You appear to be offline. Try again when you reconnect.'
    case 'auth_expired':
    case 'not_authenticated':
      return 'Connect your account to chat with Clarifi.'
    case 'plan_required':
      return 'Your plan does not include chat right now.'
    case 'rate_limit':
      return 'Too many requests — wait a moment and try again.'
    case 'message_required':
      return 'Type a message first.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

export function ChatView({ meetings, paired, onConnect, onOpenMeeting }: ChatViewProps) {
  const [meetingId, setMeetingId] = useState<string>('')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const recentMeetings = useMemo(
    () =>
      [...meetings]
        .sort((a, b) => (b.startedAt ?? b.createdAt) - (a.startedAt ?? a.createdAt))
        .slice(0, 40),
    [meetings],
  )

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, sending])

  const send = useCallback(async () => {
    const text = draft.trim()
    if (!text || sending) return
    if (!paired) {
      setError('Connect your account to chat with Clarifi.')
      return
    }

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text }
    setMessages((prev) => [...prev, userMsg])
    setDraft('')
    setSending(true)
    setError(null)

    try {
      const result = (await window.electronAPI.invoke('chat:send', {
        message: text,
        meetingId: meetingId || null,
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
  }, [draft, meetingId, paired, sending])

  return (
    <div className="chat-view">
      <header className="home-view-header chat-view-header">
        <div>
          <h1 className="home-view-title">Chat</h1>
          <p className="home-view-subtitle">
            Ask about a meeting’s notes and transcript. Context stays on this device until you send.
          </p>
        </div>
        <label className="chat-meeting-picker">
          <span className="chat-meeting-picker-label">Context</span>
          <select
            className="chat-meeting-select"
            value={meetingId}
            onChange={(event) => setMeetingId(event.target.value)}
          >
            <option value="">No meeting</option>
            {recentMeetings.map((meeting) => (
              <option key={meeting.id} value={meeting.id}>
                {meeting.title || 'Untitled meeting'}
              </option>
            ))}
          </select>
        </label>
      </header>

      {!paired ? (
        <div className="chat-connect-banner">
          <span>Connect your account to chat with Clarifi.</span>
          <button type="button" className="btn btn-primary" onClick={onConnect}>
            Connect
          </button>
        </div>
      ) : null}

      <div className="chat-thread" ref={listRef}>
        {messages.length === 0 && !sending ? (
          <div className="chat-empty">
            <p>Ask a question about a meeting, or chat without selecting one.</p>
            {meetingId ? (
              <button type="button" className="link-btn" onClick={() => onOpenMeeting(meetingId)}>
                Open selected meeting
              </button>
            ) : null}
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`chat-bubble chat-bubble-${message.role}`}
            >
              <div className="chat-bubble-role">
                {message.role === 'user' ? 'You' : 'Clarifi'}
              </div>
              <div className="chat-bubble-text">{message.text}</div>
            </div>
          ))
        )}
        {sending ? (
          <div className="chat-bubble chat-bubble-assistant">
            <div className="chat-bubble-role">Clarifi</div>
            <div className="chat-bubble-text chat-bubble-pending">Thinking…</div>
          </div>
        ) : null}
      </div>

      {error ? <p className="chat-error">{error}</p> : null}

      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <textarea
          className="chat-composer-input"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send()
            }
          }}
          placeholder={paired ? 'Ask Clarifi…' : 'Connect to chat'}
          disabled={!paired || sending}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!paired || sending || !draft.trim()}
        >
          Send
        </button>
      </form>
    </div>
  )
}
