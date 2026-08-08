import { useCallback, useEffect, useRef, useState } from 'react'

import type { ChatEffort } from '../../shared/chatOptions'
import { packTextAttachmentsIntoMessage } from '../../shared/chatAttachments'
import {
  assemblePreMeetingBrief,
  type PreMeetingBrief,
} from '../../shared/preMeetingBrief'
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
  onOpenCitation?: (citation: {
    meetingId: string
    title: string
    quote?: string
    entryId?: string
    audioStartMs?: number
  }) => void
  onInsertIntoNotes?: (text: string) => void
  onInsertIntoScratchpad?: (text: string) => void
  onUndoInsert?: () => void
  canUndoInsert?: boolean
  relatedMeetings?: Meeting[]
}

function formatBriefMessage(brief: PreMeetingBrief): string {
  return [
    `Pre-meeting brief: ${brief.eventTitle}`,
    `When: ${brief.eventStartAt}`,
    brief.attendeeEmails.length ? `Attendees: ${brief.attendeeEmails.join(', ')}` : null,
    '',
    'Goals',
    ...brief.goals.map((line) => `- ${line}`),
    '',
    'Prior decisions',
    ...brief.decisions.map((line) => `- ${line}`),
    '',
    'Open actions',
    ...brief.openActions.map((line) => `- ${line}`),
    '',
    'Suggested questions',
    ...brief.suggestedQuestions.map((line) => `- ${line}`),
  ]
    .filter((line) => line !== null)
    .join('\n')
}

type AskMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  citations?: Array<{
    meetingId: string
    title: string
    quote?: string
    entryId?: string
    audioStartMs?: number
  }>
}

const FOLLOW_UP_PROMPT =
  'Draft a concise, professional follow-up email based on this meeting. Include a subject line, a short summary, and clear next steps or action items.'
const REWRITE_NOTES_PROMPT =
  'Rewrite the current meeting notes into a clearer structured format with sections: Key points, Decisions, Risks, and Next steps.'

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
  onOpenCitation,
  onInsertIntoNotes,
  onInsertIntoScratchpad,
  onUndoInsert,
  canUndoInsert = false,
  relatedMeetings = [],
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
    try {
      const raw = window.localStorage.getItem(`clarifi-chat-thread:meeting:${meeting.id}`)
      if (!raw) return
      const parsed = JSON.parse(raw) as AskMessage[]
      if (Array.isArray(parsed)) setMessages(parsed.slice(-60))
    } catch {
      // ignore malformed cached thread
    }
  }, [meeting.id])

  useEffect(() => {
    window.localStorage.setItem(
      `clarifi-chat-thread:meeting:${meeting.id}`,
      JSON.stringify(messages.slice(-60)),
    )
  }, [meeting.id, messages])

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

      const assistantId = `a-${Date.now()}`
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', text: '' }])

      try {
        const history = messages.slice(-12).map((entry) => ({ role: entry.role, text: entry.text }))
        const { invokeChatWithStream } = await import('../lib/chatStreamClient')
        const result = await invokeChatWithStream({
          payload: {
            message: trimmed,
            meetingId: meeting.id,
            scope: 'meeting',
            history,
            model,
            effort,
            images,
          },
          onDelta: (chunk) => {
            setMessages((prev) =>
              prev.map((entry) =>
                entry.id === assistantId ? { ...entry, text: `${entry.text}${chunk}` } : entry,
              ),
            )
          },
        })

        if (result.error) {
          setMessages((prev) => prev.filter((entry) => entry.id !== assistantId))
          setError(errorMessage(result.error))
          return
        }
        if (!result.reply) {
          setMessages((prev) => prev.filter((entry) => entry.id !== assistantId))
          setError(errorMessage('chat_failed'))
          return
        }
        setMessages((prev) =>
          prev.map((entry) =>
            entry.id === assistantId
              ? {
                  ...entry,
                  text: result.reply!,
                  citations: result.citations ?? [],
                }
              : entry,
          ),
        )
      } catch {
        setMessages((prev) => prev.filter((entry) => entry.id !== assistantId))
        setError(errorMessage('chat_failed'))
      } finally {
        setSending(false)
      }
    },
    [meeting.id, onConnect, paired, sending, messages],
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
      const packed = packTextAttachmentsIntoMessage(
        payload.message.trim(),
        payload.textAttachments ?? [],
        { asMeetingContext: true },
      )
      const message =
        selectionChip && packed
          ? [
              'Selected text from the notes:',
              selectionChip,
              '',
              'User question:',
              packed,
            ].join('\n')
          : selectionChip && !packed
            ? buildSelectionPrompt({ text: selectionChip, mode: 'chat' })
            : packed
      await sendText(
        message,
        payload.images,
        payload.model,
        payload.effort as ChatEffort,
      )
    },
    [selectionChip, sendText],
  )

  const buildPreMeetingBrief = useCallback(() => {
    const emails = [
      ...(meeting.attendeeEmails ?? []),
      ...(meeting.attendees ?? [])
        .map((person) => person.email)
        .filter((email): email is string => Boolean(email)),
    ]
    const brief = assemblePreMeetingBrief({
      event: {
        id: `next-${meeting.id}`,
        title: `Follow-up: ${meeting.title}`,
        startAt: new Date(Date.now() + 3600_000).toISOString(),
        attendeeEmails: emails,
      },
      meetings: (relatedMeetings.length > 0 ? relatedMeetings : [meeting]).map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        enhancedNotes: row.enhancedNotes,
        userNotes: row.userNotes,
        attendeeEmails: [
          ...(row.attendeeEmails ?? []),
          ...(row.attendees ?? [])
            .map((person) => person.email)
            .filter((email): email is string => Boolean(email)),
        ],
        transcript: row.transcript?.map((entry) => ({ text: entry.text, at: entry.at })),
        startedAt: row.startedAt,
        createdAt: row.createdAt,
      })),
    })
    setExpanded(true)
    setMessages((prev) => [
      ...prev,
      {
        id: `a-brief-${Date.now()}`,
        role: 'assistant',
        text: formatBriefMessage(brief),
        citations: brief.citations,
      },
    ])
  }, [meeting, relatedMeetings])

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
                {msg.role === 'assistant' && msg.citations?.length ? (
                  <div className="chat-citations">
                    {msg.citations.slice(0, 5).map((citation, index) => (
                      <button
                        key={`${citation.meetingId}-${index}`}
                        type="button"
                        className="chat-citation-chip"
                        title={citation.quote || citation.title}
                        onClick={() => onOpenCitation?.(citation)}
                      >
                        {citation.title}
                      </button>
                    ))}
                  </div>
                ) : null}
                {msg.role === 'assistant' ? (
                  <div className="meeting-ask-bubble-actions">
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
                    {onInsertIntoNotes ? (
                      <button
                        type="button"
                        className="meeting-ask-bubble-copy"
                        onClick={() => onInsertIntoNotes(msg.text)}
                      >
                        Insert into notes
                      </button>
                    ) : null}
                    {onInsertIntoScratchpad ? (
                      <button
                        type="button"
                        className="meeting-ask-bubble-copy"
                        onClick={() => onInsertIntoScratchpad(msg.text)}
                      >
                        Insert into scratchpad
                      </button>
                    ) : null}
                    {canUndoInsert && onUndoInsert ? (
                      <button
                        type="button"
                        className="meeting-ask-bubble-copy"
                        onClick={() => onUndoInsert()}
                      >
                        Undo insert
                      </button>
                    ) : null}
                  </div>
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
        {expanded ? (
          <div className="meeting-ask-recipes" role="list" aria-label="Suggested actions">
            <button
              type="button"
              className="meeting-ask-recipe-chip"
              disabled={sending}
              role="listitem"
              onClick={() => void sendText(REWRITE_NOTES_PROMPT)}
            >
              <span className="meeting-ask-recipe-icon" aria-hidden>
                ✎
              </span>
              Rewrite notes
            </button>
            <button
              type="button"
              className="meeting-ask-recipe-chip"
              disabled={sending}
              role="listitem"
              onClick={buildPreMeetingBrief}
            >
              <span className="meeting-ask-recipe-icon" aria-hidden>
                ✎
              </span>
              Build pre-meeting brief
            </button>
          </div>
        ) : null}
        <ChatPromptInput
          value={draft}
          onChange={setDraft}
          onSubmit={(payload) => void send(payload)}
          onFocus={() => setExpanded(true)}
          disabled={sending}
          meetingContext
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
