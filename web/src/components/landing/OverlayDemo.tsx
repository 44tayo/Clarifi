'use client'

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type Ref,
} from 'react'
import './overlay-demo.css'

type PanelMode = 'bar' | 'chat' | 'history' | 'sessions'
type DemoSize = 'sm' | 'md' | 'lg'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  usedScreen?: boolean
}

type Suggestion = {
  text: string
  type: 'response' | 'question' | 'action'
}

export type OverlayDemoHandle = {
  nudge: (dx: number, dy: number) => void
}

export type OverlayDemoProps = {
  size?: DemoSize
  interactive?: boolean
  defaultRecording?: boolean
  defaultScreen?: boolean
  defaultFollow?: boolean
  draggable?: boolean
  showMoveArrows?: boolean
  showQuickPrompts?: boolean
  float?: boolean
  className?: string
  demoRef?: Ref<OverlayDemoHandle>
  initialMessages?: ChatMessage[]
  defaultPanelMode?: PanelMode
  defaultModeLabel?: string
}

const DEMO_TRANSCRIPT = [
  'Them · Can you walk us through the rollout timeline?',
  'You · We can start with a pilot in Q1…',
  'Them · What are the main action items from today?',
]

const DEMO_SUGGESTIONS: Suggestion[] = [
  {
    type: 'response',
    text: 'We typically run a 2-week pilot, then expand seat-by-seat so your team stays in control.',
  },
  {
    type: 'question',
    text: 'What does your current onboarding workflow look like today?',
  },
  {
    type: 'action',
    text: 'Offer to send a recap after the call with timeline and next steps.',
  },
]

const PROMPT_CHIPS = [
  { label: 'What should I say?', query: 'What should I say in this meeting?' },
  { label: 'Follow-up questions', query: 'Suggest follow-up questions' },
  { label: 'Recap', query: 'Give me a quick recap so far' },
]

export const CLARIFI_INTRO_REPLY =
  'Clarifi is an AI notepad for meetings — it listens in the background while you jot quick notes, then turns everything into a clean summary, decisions, and action items the moment you\'re done. No bot joins your call. Sign up free to get started.'

function isClarifiQuestion(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('what is clarifi') ||
    lower.includes("what's clarifi") ||
    lower.includes('what is on my screen') ||
    lower.includes("what's on my screen") ||
    lower.includes('on my screen')
  )
}

function demoReply(message: string, screenOn: boolean): string {
  const lower = message.toLowerCase()
  if (isClarifiQuestion(message)) {
    return CLARIFI_INTRO_REPLY
  }
  if (lower.includes('what should i say')) {
    return 'Try: "That\'s a fair concern — we\'ve helped teams like yours cut onboarding time by about 40%. Happy to show you how in a quick pilot."'
  }
  if (lower.includes('follow-up') || lower.includes('question')) {
    return '**Good follow-ups to ask:**\n- What would success look like in 90 days?\n- Who else should weigh in before you decide?\n- Is budget already allocated for this quarter?'
  }
  if (lower.includes('recap')) {
    return '**So far:** They asked about rollout timing and CRM integration. You offered a Q1 pilot. Next, clarify decision-makers and confirm budget timing.'
  }
  if (screenOn) {
    return CLARIFI_INTRO_REPLY
  }
  return CLARIFI_INTRO_REPLY
}

function ScreenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  )
}

function FollowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  )
}

function ToolbarTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="od-tip-wrap">
      <span className="od-tip" role="tooltip">
        {label}
      </span>
      {children}
    </div>
  )
}

function renderSimpleMarkdown(text: string): ReactNode {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) return null
    if (trimmed.startsWith('- ')) {
      return (
        <p key={i} style={{ marginLeft: 8 }}>
          • {trimmed.slice(2)}
        </p>
      )
    }
    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      return (
        <p key={i} style={{ fontWeight: 600, marginBottom: 4 }}>
          {trimmed.slice(2, -2)}
        </p>
      )
    }
    return <p key={i}>{trimmed}</p>
  })
}

export function OverlayDemo({
  size = 'md',
  interactive = true,
  defaultRecording = false,
  defaultScreen = false,
  defaultFollow = true,
  draggable = false,
  showMoveArrows = false,
  showQuickPrompts = false,
  float = false,
  className = '',
  demoRef,
  initialMessages = [],
  defaultPanelMode = 'bar',
  defaultModeLabel = 'General',
}: OverlayDemoProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const [panelMode, setPanelMode] = useState<PanelMode>(defaultPanelMode)
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [thinking, setThinking] = useState(false)
  const [isRecording, setIsRecording] = useState(defaultRecording)
  const [screenOn, setScreenOn] = useState(defaultScreen)
  const [followOn, setFollowOn] = useState(defaultFollow)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [transcriptLines, setTranscriptLines] = useState<string[]>([])

  const hasChat = messages.length > 0
  const canInteract = interactive

  useEffect(() => {
    if (!isRecording) {
      setTranscriptLines([])
      return
    }
    let i = 0
    setTranscriptLines([DEMO_TRANSCRIPT[0]])
    const id = window.setInterval(() => {
      i = (i + 1) % DEMO_TRANSCRIPT.length
      setTranscriptLines(DEMO_TRANSCRIPT.slice(0, i + 1))
    }, 2800)
    return () => window.clearInterval(id)
  }, [isRecording])

  const submitQuery = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || !canInteract) return

      setQuery('')
      setPanelMode('chat')
      const userMsg: ChatMessage = { role: 'user', content: trimmed }
      setMessages((prev) => [...prev, userMsg])
      setThinking(true)

      window.setTimeout(() => {
        setThinking(false)
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: demoReply(trimmed, screenOn),
            usedScreen: screenOn,
          },
        ])
      }, 700)
    },
    [canInteract, screenOn],
  )

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    submitQuery(query)
  }

  const nudge = useCallback((dx: number, dy: number) => {
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }))
  }, [])

  useImperativeHandle(demoRef, () => ({ nudge }), [nudge])

  useEffect(() => {
    if (!draggable || !canInteract) return

    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey) return
      const step = 12
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        nudge(0, -step)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        nudge(0, step)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        nudge(-step, 0)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        nudge(step, 0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draggable, canInteract, nudge])

  const onPointerDown = (e: React.PointerEvent) => {
    if (!draggable || !canInteract || !rootRef.current) return
    if ((e.target as HTMLElement).closest('button, input, .od-prompt-chip, .od-suggestion')) return
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
    setDragging(true)
    rootRef.current.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.x
    const dy = e.clientY - dragRef.current.y
    setOffset({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null
    setDragging(false)
    rootRef.current?.releasePointerCapture(e.pointerId)
  }

  const placeholder =
    screenOn ? 'Ask anything about your screen' : hasChat ? 'Ask follow-up' : 'Ask me anything'

  const toggleSessions = () => {
    setPanelMode((m) => (m === 'sessions' ? 'bar' : 'sessions'))
  }

  const toggleHistory = () => {
    setPanelMode((m) => (m === 'history' ? 'bar' : 'history'))
  }

  const renderToolbar = () => (
    <div className="od-toolbar">
      <div className="od-toolbar-left">
        <div className={`od-dot ${isRecording ? 'recording' : ''}`} />
        <span className="od-brand">Clarifi</span>

        <ToolbarTip label="Change mode & system prompt">
          <button type="button" className="od-pill od-mode-pill" disabled={!canInteract}>
            <span className="od-pill-label">{defaultModeLabel}</span>
          </button>
        </ToolbarTip>

        <ToolbarTip label="Uses Screen">
          <button
            type="button"
            className={`od-icon ${screenOn ? 'active' : ''}`}
            onClick={() => canInteract && setScreenOn((v) => !v)}
            disabled={!canInteract}
            aria-pressed={screenOn}
          >
            <ScreenIcon />
          </button>
        </ToolbarTip>

        <ToolbarTip label={followOn ? 'Follow screen' : 'Pinned position'}>
          <button
            type="button"
            className={`od-icon ${followOn ? 'active' : ''}`}
            onClick={() => canInteract && setFollowOn((v) => !v)}
            disabled={!canInteract}
            aria-pressed={followOn}
          >
            <FollowIcon />
          </button>
        </ToolbarTip>
      </div>

      <div className="od-divider" />

      <div className="od-toolbar-right">
        <ToolbarTip label={isRecording ? 'Stop Audio Session' : 'Start Audio Session'}>
          <button
            type="button"
            className={`od-icon od-audio ${isRecording ? 'active' : ''}`}
            onClick={() => canInteract && setIsRecording((v) => !v)}
            disabled={!canInteract}
            aria-pressed={isRecording}
          >
            <span className={`od-waveform ${isRecording ? 'active' : ''}`}>
              <span />
              <span />
              <span />
              <span />
            </span>
          </button>
        </ToolbarTip>

        <ToolbarTip label="Audio sessions">
          <button
            type="button"
            className={`od-history-btn ${panelMode === 'sessions' ? 'active' : ''}`}
            onClick={() => canInteract && toggleSessions()}
            disabled={!canInteract}
            aria-expanded={panelMode === 'sessions'}
          >
            <span>Sessions</span>
            <span className={`od-chevron ${panelMode === 'sessions' ? 'up' : ''}`}>▼</span>
          </button>
        </ToolbarTip>

        <ToolbarTip label="History">
          <button
            type="button"
            className={`od-history-btn ${panelMode === 'history' ? 'active' : ''}`}
            onClick={() => canInteract && toggleHistory()}
            disabled={!canInteract}
            aria-expanded={panelMode === 'history'}
          >
            <span>History</span>
            <span className={`od-chevron ${panelMode === 'history' ? 'up' : ''}`}>▼</span>
          </button>
        </ToolbarTip>
      </div>
    </div>
  )

  return (
    <div
      ref={rootRef}
      className={`od-root size-${size} ${draggable ? 'draggable' : ''} ${dragging ? 'od-dragging' : ''} ${float ? 'od-float' : ''} ${className}`.trim()}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {showMoveArrows && (
        <div className="od-arrows" aria-hidden>
          <span className="up">↑</span>
          <span className="down">↓</span>
          <span className="left">←</span>
          <span className="right">→</span>
        </div>
      )}

      <div className="od-stack">
        {panelMode === 'chat' && (
          <div className="od-panel">
            <form className="od-panel-header" onSubmit={handleSubmit}>
              <button
                type="button"
                className="od-back-btn"
                onClick={() => setPanelMode('bar')}
                aria-label="Back"
              >
                ←
              </button>
              <input
                type="text"
                className="od-input"
                placeholder="Ask follow-up"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={thinking || !canInteract}
              />
              <button type="submit" className="od-submit" disabled={thinking || !canInteract}>
                ↵
              </button>
            </form>

            <div className="od-chat-body">
              {messages.map((msg, i) =>
                msg.role === 'user' ? (
                  <div key={i} className="od-user-row">
                    <div className="od-user-bubble">{msg.content}</div>
                  </div>
                ) : (
                  <div key={i} className="od-assistant-block">
                    {msg.usedScreen && <div className="od-viewed-label">Viewed Screen</div>}
                    <div className="od-assistant-content">{renderSimpleMarkdown(msg.content)}</div>
                  </div>
                ),
              )}
              {thinking && (
                <div className="od-thinking">
                  {screenOn ? 'Viewing screen…' : 'Thinking…'}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="od-bar">
          {panelMode !== 'chat' && (
            <form className="od-input-row" onSubmit={handleSubmit}>
              {hasChat && (
                <button
                  type="button"
                  className="od-back-btn"
                  onClick={() => setPanelMode('chat')}
                  aria-label="Back to chat"
                >
                  ←
                </button>
              )}
              <input
                type="text"
                className="od-input"
                placeholder={placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={thinking || !canInteract}
                onFocus={() => {
                  if (hasChat && panelMode === 'bar') setPanelMode('chat')
                }}
                readOnly={!canInteract}
              />
              <button type="submit" className="od-submit" disabled={thinking || !canInteract}>
                ↵
              </button>
            </form>
          )}

          {renderToolbar()}
        </div>

        {panelMode === 'sessions' && (
          <div className="od-expanded">
            <div className="od-expanded-label">Audio sessions</div>
            <div className="od-session-row">Product demo · 12 min</div>
            <div className="od-session-row">Weekly sync · 34 min</div>
            <div className="od-session-row muted">No active session</div>
          </div>
        )}

        {panelMode === 'history' && (
          <div className="od-expanded">
            {isRecording && transcriptLines.length > 0 && (
              <>
                <div className="od-expanded-label">Transcript</div>
                {transcriptLines.map((line, i) => (
                  <div key={i} className="od-transcript-line">
                    {line}
                  </div>
                ))}
              </>
            )}
            <div className="od-expanded-label" style={{ marginTop: isRecording ? 12 : 0 }}>
              Suggestions
            </div>
            {DEMO_SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                type="button"
                className={`od-suggestion type-${s.type}`}
                onClick={() => canInteract && submitQuery(s.text)}
                disabled={!canInteract}
              >
                <span className="od-suggestion-icon">
                  {s.type === 'response' ? '💬' : s.type === 'question' ? '❓' : '✓'}
                </span>
                <span>{s.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showQuickPrompts && canInteract && (
        <div className="od-prompts">
          {PROMPT_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              className="od-prompt-chip"
              onClick={() => submitQuery(chip.query)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** @deprecated Use OverlayDemo — kept for import compatibility */
export function ProductWidget(props: OverlayDemoProps) {
  return <OverlayDemo {...props} />
}

export function ActionBar() {
  return null
}
