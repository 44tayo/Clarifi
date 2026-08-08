import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { packTextAttachmentsIntoMessage } from '../../shared/chatAttachments'
import type { Folder, Meeting } from '../types/meeting'
import { ChatPromptInput, type ChatPromptSubmit } from './ChatPromptInput'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  citations?: Array<{ meetingId: string; title: string; quote?: string }>
}

type ChatViewProps = {
  meetings: Meeting[]
  folders: Folder[]
  paired: boolean
  onConnect: () => void
  onOpenMeeting: (id: string) => void
  onOpenCitation?: (citation: {
    meetingId: string
    title: string
    quote?: string
    entryId?: string
    audioStartMs?: number
  }) => void
  initialScope?: 'all' | 'meeting' | 'folder' | 'selected' | 'person' | 'company'
  initialPersonEmail?: string
  initialCompany?: string
  onOpenEntity?: (kind: 'person' | 'company', value: string) => void
}

function errorMessage(code: string): string {
  switch (code) {
    case 'network_error':
      return 'You appear to be offline. Try again when you reconnect.'
    case 'auth_expired':
    case 'not_authenticated':
      return 'Connect your account to chat with Clarifi.'
    case 'plan_required':
      return 'Your plan does not include this chat option. Upgrade to Pro for premium models.'
    case 'rate_limit':
      return 'Too many requests — wait a moment and try again.'
    case 'message_required':
      return 'Type a message first.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

type ChatScope = 'meeting' | 'all' | 'folder' | 'selected' | 'person' | 'company'

function threadStorageKey(scope: ChatScope, key: string): string {
  return `clarifi-chat-thread:${scope}:${key}`
}

export function ChatView({
  meetings,
  folders,
  paired,
  onConnect,
  onOpenMeeting,
  onOpenCitation,
  initialScope = 'all',
  initialPersonEmail = '',
  initialCompany = '',
  onOpenEntity,
}: ChatViewProps) {
  const domainFromEmail = (email: string): string | null => {
    const parts = email.split('@')
    if (parts.length !== 2) return null
    return parts[1]?.toLowerCase() || null
  }

  const [meetingId, setMeetingId] = useState<string>('')
  const [scope, setScope] = useState<ChatScope>(initialScope)
  const [folderId, setFolderId] = useState<string>('')
  const [personEmail, setPersonEmail] = useState(initialPersonEmail)
  const [company, setCompany] = useState(initialCompany)
  const [selectedMeetingIds, setSelectedMeetingIds] = useState<string[]>([])
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

  const threadKey = useMemo(() => {
    if (scope === 'meeting') return threadStorageKey('meeting', meetingId || 'none')
    if (scope === 'folder') return threadStorageKey('folder', folderId || 'none')
    if (scope === 'selected') return threadStorageKey('selected', selectedMeetingIds.sort().join(',') || 'none')
    if (scope === 'person') return threadStorageKey('person', personEmail.trim().toLowerCase() || 'none')
    if (scope === 'company') return threadStorageKey('company', company.trim().toLowerCase() || 'none')
    return threadStorageKey('all', 'all')
  }, [company, folderId, meetingId, personEmail, scope, selectedMeetingIds])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(threadKey)
      if (!raw) {
        setMessages([])
        return
      }
      const parsed = JSON.parse(raw) as ChatMessage[]
      if (!Array.isArray(parsed)) {
        setMessages([])
        return
      }
      setMessages(parsed.slice(-60))
    } catch {
      setMessages([])
    }
  }, [threadKey])

  useEffect(() => {
    window.localStorage.setItem(threadKey, JSON.stringify(messages.slice(-60)))
  }, [messages, threadKey])

  const knownPeople = useMemo(() => {
    const emails = new Set<string>()
    for (const meeting of meetings) {
      for (const email of meeting.attendeeEmails ?? []) emails.add(email.toLowerCase())
      for (const person of meeting.attendees ?? []) {
        if (person.email) emails.add(person.email.toLowerCase())
      }
    }
    return [...emails].sort()
  }, [meetings])

  const knownCompanies = useMemo(() => {
    const names = new Set<string>()
    for (const meeting of meetings) {
      for (const email of meeting.attendeeEmails ?? []) {
        const domain = domainFromEmail(email)
        if (domain) names.add(domain)
      }
      for (const person of meeting.attendees ?? []) {
        if (person.email) {
          const domain = domainFromEmail(person.email)
          if (domain) names.add(domain)
        }
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [meetings])

  const send = useCallback(
    async (payload: ChatPromptSubmit) => {
      const text = packTextAttachmentsIntoMessage(
        payload.message.trim(),
        payload.textAttachments ?? [],
      )
      if ((!text && payload.images.length === 0) || sending) return
      if (!paired) {
        setError('Connect your account to chat with Clarifi.')
        return
      }

      const display =
        payload.images.length > 0 || (payload.textAttachments?.length ?? 0) > 0
          ? `${text}${text ? '\n' : ''}[${[
              payload.images.length
                ? `${payload.images.length} image${payload.images.length === 1 ? '' : 's'}`
                : null,
              payload.textAttachments?.length
                ? `${payload.textAttachments.length} file${
                    payload.textAttachments.length === 1 ? '' : 's'
                  }`
                : null,
            ]
              .filter(Boolean)
              .join(', ')} attached]`
          : text
      const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: display }
      setMessages((prev) => [...prev, userMsg])
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
            message: text,
            meetingId: scope === 'meeting' ? meetingId || null : null,
            scope,
            folderId: scope === 'folder' ? folderId || null : null,
            selectedMeetingIds: scope === 'selected' ? selectedMeetingIds : [],
            personEmail: scope === 'person' ? personEmail.trim() || null : null,
            company: scope === 'company' ? company.trim() || null : null,
            history,
            model: payload.model,
            effort: payload.effort,
            images: payload.images,
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
    [meetingId, paired, scope, sending, messages, folderId, selectedMeetingIds, personEmail, company],
  )

  return (
    <div className="chat-view">
      <header className="home-view-header chat-view-header">
        <div>
          <h1 className="home-view-title">Chat</h1>
          <p className="home-view-subtitle">
            Ask about one meeting or across all your local notes. Context stays on this device until
            you send.
          </p>
        </div>
        <div className="chat-meeting-picker">
          <label className="chat-meeting-picker">
            <span className="chat-meeting-picker-label">Scope</span>
            <select
              className="chat-meeting-select"
              value={scope}
              onChange={(event) =>
                setScope(
                  event.target.value === 'all' ||
                    event.target.value === 'folder' ||
                    event.target.value === 'selected' ||
                    event.target.value === 'person' ||
                    event.target.value === 'company'
                    ? event.target.value
                    : 'meeting',
                )
              }
            >
              <option value="meeting">This meeting</option>
              <option value="all">All meetings</option>
              <option value="folder">Folder</option>
              <option value="selected">Selected meetings</option>
              <option value="person">Person</option>
              <option value="company">Company</option>
            </select>
          </label>
          {scope === 'meeting' ? (
            <label className="chat-meeting-picker">
              <span className="chat-meeting-picker-label">Meeting</span>
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
          ) : null}
          {scope === 'folder' ? (
            <label className="chat-meeting-picker">
              <span className="chat-meeting-picker-label">Folder</span>
              <select
                className="chat-meeting-select"
                value={folderId}
                onChange={(event) => setFolderId(event.target.value)}
              >
                <option value="">Choose folder</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {scope === 'selected' ? (
            <label className="chat-meeting-picker">
              <span className="chat-meeting-picker-label">Meetings</span>
              <select
                className="chat-meeting-select"
                multiple
                value={selectedMeetingIds}
                onChange={(event) =>
                  setSelectedMeetingIds(
                    [...event.target.selectedOptions].map((option) => option.value).slice(0, 20),
                  )
                }
              >
                {recentMeetings.map((meeting) => (
                  <option key={meeting.id} value={meeting.id}>
                    {meeting.title || 'Untitled meeting'}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {scope === 'person' ? (
            <label className="chat-meeting-picker">
              <span className="chat-meeting-picker-label">Person email</span>
              <input
                className="chat-meeting-select"
                list="chat-person-list"
                value={personEmail}
                onChange={(event) => setPersonEmail(event.target.value)}
                placeholder="name@company.com"
              />
              <datalist id="chat-person-list">
                {knownPeople.map((email) => (
                  <option key={email} value={email} />
                ))}
              </datalist>
              {onOpenEntity && personEmail.trim() ? (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => onOpenEntity('person', personEmail.trim())}
                >
                  Open person memory
                </button>
              ) : null}
            </label>
          ) : null}
          {scope === 'company' ? (
            <label className="chat-meeting-picker">
              <span className="chat-meeting-picker-label">Company</span>
              <input
                className="chat-meeting-select"
                list="chat-company-list"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="acme.com"
              />
              <datalist id="chat-company-list">
                {knownCompanies.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              {onOpenEntity && company.trim() ? (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => onOpenEntity('company', company.trim())}
                >
                  Open company memory
                </button>
              ) : null}
            </label>
          ) : null}
        </div>
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
              {message.role === 'assistant' && message.citations?.length ? (
                <div className="chat-citations">
                  {message.citations.slice(0, 5).map((citation, index) => (
                    <button
                      key={`${citation.meetingId}-${index}`}
                      type="button"
                      className="chat-citation-chip"
                      onClick={() =>
                        onOpenCitation
                          ? onOpenCitation(citation)
                          : onOpenMeeting(citation.meetingId)
                      }
                      title={citation.quote || citation.title}
                    >
                      {citation.title}
                    </button>
                  ))}
                </div>
              ) : null}
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

      <div className="chat-composer">
        <ChatPromptInput
          value={draft}
          onChange={setDraft}
          onSubmit={(payload) => void send(payload)}
          placeholder={paired ? 'Ask Clarifi…' : 'Connect to chat'}
          disabled={!paired}
          sending={sending}
        />
      </div>
    </div>
  )
}
