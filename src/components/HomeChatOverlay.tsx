import { useCallback, useEffect, useRef, useState } from 'react'

import type { ChatEffort } from '../../shared/chatOptions'
import { packTextAttachmentsIntoMessage } from '../../shared/chatAttachments'
import { ChatPromptInput, type ChatPromptSubmit } from './ChatPromptInput'
import { StatefulButton } from './ui/StatefulButton'
import { useToast } from '../hooks/useToast'

export type HomeChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  citations?: Array<{ meetingId: string; title: string; quote?: string }>
}

type HomeChatOverlayProps = {
  paired: boolean
  onConnect: () => void
  onOpenChatView?: () => void
  onOpenCitation?: (citation: {
    meetingId: string
    title: string
    quote?: string
    entryId?: string
    audioStartMs?: number
  }) => void
}

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

export function HomeChatOverlay({ paired, onConnect, onOpenChatView, onOpenCitation }: HomeChatOverlayProps) {
  const { toast } = useToast()
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<HomeChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const [scrollMetrics, setScrollMetrics] = useState({ thumbTop: 0, thumbHeight: 0, visible: false })

  const threadRef = useRef<HTMLDivElement>(null)
  const scrollHideTimer = useRef<number | null>(null)

  const updateScrollUi = useCallback(() => {
    const el = threadRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const distance = scrollHeight - clientHeight - scrollTop
    setAtBottom(distance < 48)

    const overflow = scrollHeight > clientHeight + 2
    if (!overflow) {
      setScrollMetrics({ thumbTop: 0, thumbHeight: 0, visible: false })
      return
    }
    const ratio = clientHeight / scrollHeight
    const thumbHeight = Math.max(28, Math.round(clientHeight * ratio))
    const maxTop = clientHeight - thumbHeight
    const progress = scrollTop / Math.max(1, scrollHeight - clientHeight)
    setScrollMetrics({
      thumbTop: Math.round(maxTop * progress),
      thumbHeight,
      visible: true,
    })

    if (scrollHideTimer.current) window.clearTimeout(scrollHideTimer.current)
    scrollHideTimer.current = window.setTimeout(() => {
      setScrollMetrics((prev) => ({ ...prev, visible: false }))
    }, 900)
  }, [])

  const scrollToBottom = useCallback((smooth = true) => {
    const el = threadRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useEffect(() => {
    if (!open) return
    scrollToBottom(false)
    updateScrollUi()
  }, [messages, sending, open, scrollToBottom, updateScrollUi])

  useEffect(
    () => () => {
      if (scrollHideTimer.current) window.clearTimeout(scrollHideTimer.current)
    },
    [],
  )

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('clarifi-chat-thread:home')
      if (!raw) return
      const parsed = JSON.parse(raw) as HomeChatMessage[]
      if (Array.isArray(parsed)) setMessages(parsed.slice(-60))
    } catch {
      // ignore malformed cached thread
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem('clarifi-chat-thread:home', JSON.stringify(messages.slice(-60)))
  }, [messages])

  const send = useCallback(
    async (payload: ChatPromptSubmit) => {
      const text = packTextAttachmentsIntoMessage(
        payload.message.trim(),
        payload.textAttachments ?? [],
      )
      if ((!text && payload.images.length === 0) || sending) return
      if (!paired) {
        setError('Connect your account to ask Clarifi.')
        setOpen(true)
        return
      }

      setOpen(true)
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
            message: text,
            meetingId: null,
            scope: 'all',
            history,
            model: payload.model,
            effort: payload.effort as ChatEffort,
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
    [paired, sending, messages],
  )

  const startNewChat = () => {
    setMessages([])
    setError(null)
    setDraft('')
    setOpen(false)
  }

  const sheetOpen = open || messages.length > 0

  return (
    <>
      {sheetOpen ? (
        <button
          type="button"
          className="home-chat-backdrop"
          aria-label="Dismiss chat overlay"
          onClick={() => {
            if (messages.length === 0) setOpen(false)
          }}
        />
      ) : null}

      <div className={`home-chat-layer${sheetOpen ? ' is-open' : ''}`}>
        {sheetOpen ? (
          <div className="home-chat-sheet" role="dialog" aria-label="Ask Clarifi">
            <header className="home-chat-sheet-header">
              <button
                type="button"
                className="home-chat-icon-btn"
                aria-label="New chat"
                onClick={startNewChat}
                title="New chat"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M3.5 12.5 12.5 3.5M8.5 3.5h4v4"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3.5 8.5V12.5H7.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div className="home-chat-sheet-header-right">
                {onOpenChatView ? (
                  <button
                    type="button"
                    className="home-chat-icon-btn"
                    aria-label="Open full chat"
                    onClick={onOpenChatView}
                    title="Open Chat"
                  >
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path
                        d="M6 3.5H3.5v9h9V10M8.5 3.5H12.5V7.5M12.5 3.5 7 9"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                ) : null}
                <button
                  type="button"
                  className="home-chat-icon-btn"
                  aria-label="Close chat"
                  onClick={startNewChat}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d="M3.5 3.5 10.5 10.5M10.5 3.5 3.5 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </header>

            <div className="home-chat-thread-wrap">
              <div
                className="home-chat-thread"
                ref={threadRef}
                onScroll={updateScrollUi}
              >
                {messages.length === 0 && !sending ? (
                  <div className="home-chat-empty">
                    <p>Ask anything about your meetings.</p>
                    {!paired ? (
                      <button type="button" className="btn btn-secondary" onClick={onConnect}>
                        Connect account
                      </button>
                    ) : null}
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`home-chat-bubble home-chat-bubble-${message.role}`}
                    >
                      {message.role === 'assistant' ? (
                        <>
                          <div className="home-chat-bubble-text">{message.text}</div>
                          {message.citations?.length ? (
                            <div className="chat-citations">
                              {message.citations.slice(0, 5).map((citation, index) => (
                                <button
                                  key={`${citation.meetingId}-${index}`}
                                  type="button"
                                  className="chat-citation-chip"
                                  title={citation.quote || citation.title}
                                  onClick={() =>
                                    onOpenCitation
                                      ? onOpenCitation(citation)
                                      : onOpenChatView?.()
                                  }
                                >
                                  {citation.title}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="home-chat-bubble-pill">{message.text}</div>
                      )}
                      {message.role === 'assistant' ? (
                        <div className="home-chat-actions">
                          <button
                            type="button"
                            className="home-chat-say-more"
                            onClick={() => {
                              setDraft('Say more about that.')
                              setOpen(true)
                            }}
                          >
                            Say more
                          </button>
                          <StatefulButton
                            variant="ghost"
                            iconOnly
                            idleLabel=""
                            successLabel=""
                            successDuration={1400}
                            className="home-chat-icon-btn"
                            aria-label="Copy reply"
                            icon={
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                                <rect
                                  x="5.5"
                                  y="5.5"
                                  width="7"
                                  height="7"
                                  rx="1.5"
                                  stroke="currentColor"
                                  strokeWidth="1.3"
                                />
                                <path
                                  d="M3.5 10.5V3.5H10.5"
                                  stroke="currentColor"
                                  strokeWidth="1.3"
                                  strokeLinecap="round"
                                />
                              </svg>
                            }
                            onClick={async () => {
                              await navigator.clipboard.writeText(message.text)
                              toast('Copied')
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
                {sending ? (
                  <div className="home-chat-bubble home-chat-bubble-assistant">
                    <div className="home-chat-bubble-text home-chat-pending">Thinking…</div>
                  </div>
                ) : null}
              </div>

              <div
                className={`home-chat-scroll-rail${scrollMetrics.visible ? ' is-visible' : ''}`}
                aria-hidden
              >
                <span
                  className="home-chat-scroll-thumb"
                  style={{
                    height: scrollMetrics.thumbHeight,
                    transform: `translateY(${scrollMetrics.thumbTop}px)`,
                  }}
                />
              </div>

              {!atBottom && messages.length > 0 ? (
                <button
                  type="button"
                  className="home-chat-jump"
                  aria-label="Jump to latest message"
                  onClick={() => scrollToBottom(true)}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path
                      d="M7 2.5v9M7 11.5 3.5 8M7 11.5 10.5 8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ) : null}
            </div>

            {error ? <p className="home-chat-error">{error}</p> : null}

            <div className="home-chat-composer">
              {!paired ? (
                <p className="home-chat-dock-hint" style={{ marginBottom: 8 }}>
                  <button type="button" className="link-btn" onClick={onConnect}>
                    Connect account
                  </button>{' '}
                  to ask Clarifi
                </p>
              ) : null}
              <ChatPromptInput
                value={draft}
                onChange={setDraft}
                onSubmit={(payload) => void send(payload)}
                placeholder={paired ? 'Ask Clarifi…' : 'Connect to ask Clarifi…'}
                disabled={!paired}
                sending={sending}
                autoFocus
              />
            </div>
          </div>
        ) : (
          <div className="home-chat-dock">
            <ChatPromptInput
              value={draft}
              onChange={setDraft}
              onSubmit={(payload) => void send(payload)}
              onFocus={() => setOpen(true)}
              placeholder={paired ? 'Ask Clarifi…' : 'Connect to ask Clarifi…'}
              disabled={!paired}
              sending={sending}
            />
            {!paired ? (
              <p className="home-chat-dock-hint">
                <button type="button" className="link-btn" onClick={onConnect}>
                  Connect account
                </button>{' '}
                to ask Clarifi
              </p>
            ) : null}
            {error ? <p className="home-chat-error">{error}</p> : null}
          </div>
        )}
      </div>
    </>
  )
}
