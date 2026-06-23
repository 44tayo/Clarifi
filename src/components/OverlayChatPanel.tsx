'use client'

import type { FormEvent, ReactNode, RefObject } from 'react'

export type OverlayChatMessage = {
  role: 'user' | 'assistant'
  content: string
  usedScreen?: boolean
}

function renderInlineBold(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function renderMarkdown(text: string): ReactNode {
  const lines = text.split('\n')
  const elements: ReactNode[] = []
  let listItems: ReactNode[] = []

  const flushList = (key: string) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key} className="chat-md-list">
          {listItems}
        </ul>,
      )
      listItems = []
    }
  }

  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    if (!trimmed) {
      flushList(`gap-${idx}`)
      return
    }
    if (trimmed.startsWith('- ')) {
      listItems.push(<li key={idx}>{renderInlineBold(trimmed.slice(2))}</li>)
      return
    }
    flushList(`pre-${idx}`)
    if (trimmed.endsWith(':') && trimmed.length < 40 && !trimmed.includes('.')) {
      elements.push(
        <div key={idx} className="chat-md-heading">
          {trimmed}
        </div>,
      )
    } else {
      elements.push(
        <p key={idx} className="chat-md-paragraph">
          {renderInlineBold(trimmed)}
        </p>,
      )
    }
  })
  flushList('end')
  return <>{elements}</>
}

function ChatThread({
  messages,
  onCopy,
  copiedIndex,
}: {
  messages: OverlayChatMessage[]
  onCopy?: (text: string, index: number) => void
  copiedIndex?: number | null
}) {
  return (
    <div>
      {messages.map((msg, i) =>
        msg.role === 'user' ? (
          <div key={i} className="chat-user-row">
            <div className="chat-user-bubble">{msg.content}</div>
          </div>
        ) : (
          <div key={i} className="chat-assistant-block">
            {msg.usedScreen && <div className="chat-viewed-label">Viewed screen</div>}
            <div className="chat-assistant-content">{renderMarkdown(msg.content)}</div>
            {onCopy && (
              <div className="chat-copy-row">
                <button
                  type="button"
                  className="chat-copy-btn"
                  onClick={() => onCopy(msg.content, i)}
                  aria-label="Copy response"
                >
                  {copiedIndex === i ? (
                    <span className="chat-copy-done">Copied ✓</span>
                  ) : (
                    <>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      <span className="chat-copy-label">Copy</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ),
      )}
    </div>
  )
}

type OverlayChatPanelProps = {
  query: string
  onQueryChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
  onBack: () => void
  messages: OverlayChatMessage[]
  loading: boolean
  status: string
  screenContextEnabled: boolean
  chatBodyRef: RefObject<HTMLDivElement>
  showScrollDown: boolean
  onScrollDown: () => void
  onCopy: (text: string, index: number) => void
  copiedIndex: number | null
  tourHighlight?: string
  toolbar: ReactNode
  onBackClickSound?: () => void
  onSubmitClickSound?: () => void
}

export function OverlayChatPanel({
  query,
  onQueryChange,
  onSubmit,
  onBack,
  messages,
  loading,
  status,
  screenContextEnabled,
  chatBodyRef,
  showScrollDown,
  onScrollDown,
  onCopy,
  copiedIndex,
  tourHighlight = '',
  toolbar,
  onBackClickSound,
  onSubmitClickSound,
}: OverlayChatPanelProps) {
  return (
    <div className="overlay-panel">
        <form className={`chat-header${tourHighlight}`} onSubmit={onSubmit}>
          <button
            type="button"
            className={`chat-back-btn${tourHighlight}`}
            onClick={() => {
              onBackClickSound?.()
              onBack()
            }}
            aria-label="Back"
          >
            ←
          </button>
          <input
            type="text"
            className="overlay-input chat-followup-input"
            placeholder="Ask follow-up"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className="overlay-submit"
            disabled={loading}
            onClick={() => onSubmitClickSound?.()}
          >
            ↵
          </button>
        </form>

        <div className="chat-body" ref={chatBodyRef}>
          <ChatThread messages={messages} onCopy={onCopy} copiedIndex={copiedIndex} />

          {loading && (
            <div className="chat-assistant-block">
              {screenContextEnabled && <div className="chat-viewed-label">Viewed screen</div>}
              <div className="chat-status-text">{status || 'Thinking...'}</div>
            </div>
          )}

          {!loading && status && <div className="chat-status-text">{status}</div>}
        </div>

        {showScrollDown && (
          <button
            type="button"
            className="chat-scroll-down"
            onClick={onScrollDown}
            aria-label="Scroll down"
          >
            ↓
          </button>
        )}

        {toolbar}
    </div>
  )
}
