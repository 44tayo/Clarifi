import { useCallback, useEffect, useState } from 'react'

type ProactiveSuggestedAction = {
  action_id: string
  label: string
  description: string
  priority: 'high' | 'medium' | 'low'
}

type ProactiveSuggestionsPayload = {
  analysis: {
    context_type: string
    activity_summary: string
    detected_elements: string[]
    suggested_actions: ProactiveSuggestedAction[]
  }
  fingerprint: string
  capturedAt: number
  expiresAt: number
}

type ProactivePanelPayload =
  | { kind: 'writing'; sourceText: string; result: string; mode: string }
  | {
      kind: 'summary'
      result: {
        bullets: string[]
        takeaway: string
        decisions: string[]
        openQuestions: string[]
        markdown: string
      }
    }
  | {
      kind: 'action_items'
      items: Array<{
        id: string
        text: string
        owner: string | null
        deadline: string | null
        priority: string
        completed: boolean
      }>
    }
  | { kind: 'draft'; text: string; tone: string; goal: string | null }

type ProactiveActionTrayProps = {
  onRunAction: (action: ProactiveSuggestedAction) => void
}

export function ProactiveActionTray({ onRunAction }: ProactiveActionTrayProps) {
  const [payload, setPayload] = useState<ProactiveSuggestionsPayload | null>(null)
  const [clipboardAction, setClipboardAction] = useState<{
    action: ProactiveSuggestedAction
    sourceText: string
  } | null>(null)

  useEffect(() => {
    void window.electronAPI.invoke('proactive:suggestions-get').then((data) => {
      const result = data as { payload?: ProactiveSuggestionsPayload | null }
      if (result?.payload) setPayload(result.payload)
    })

    window.electronAPI.on('proactive:suggestions-update', (p) => {
      setPayload((p as ProactiveSuggestionsPayload | null) ?? null)
    })

    window.electronAPI.on('proactive:clipboard-suggestion', (p) => {
      const data = p as {
        action_id: string
        label: string
        description: string
        priority: string
        sourceText: string
      }
      if (!data?.sourceText) return
      setClipboardAction({
        sourceText: data.sourceText,
        action: {
          action_id: data.action_id,
          label: data.label,
          description: data.description,
          priority: data.priority as ProactiveSuggestedAction['priority'],
        },
      })
    })
  }, [])

  const dismiss = () => {
    void window.electronAPI.invoke('proactive:dismiss')
    setPayload(null)
    setClipboardAction(null)
  }

  const actions = payload?.analysis.suggested_actions ?? []
  const showTray = actions.length > 0 || clipboardAction

  if (!showTray) return null

  return (
    <div className="proactive-action-tray">
      <div className="proactive-tray-header">
        <span className="proactive-tray-label">
          {payload?.analysis.activity_summary ?? 'Clarifi noticed something'}
        </span>
        <button type="button" className="proactive-tray-dismiss" onClick={dismiss}>
          ✕
        </button>
      </div>
      <div className="proactive-tray-pills">
        {clipboardAction ? (
          <button
            type="button"
            className="proactive-pill proactive-pill-high"
            title={clipboardAction.action.description}
            onClick={() => {
              void window.electronAPI.invoke('proactive:writing-transform', {
                text: clipboardAction.sourceText,
                mode: 'rewrite',
              })
              setClipboardAction(null)
            }}
          >
            {clipboardAction.action.label}
          </button>
        ) : null}
        {actions.map((action) => (
          <button
            key={action.action_id}
            type="button"
            className={`proactive-pill proactive-pill-${action.priority}`}
            title={action.description}
            onClick={() => onRunAction(action)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}

type ProactivePanelProps = {
  panel: ProactivePanelPayload | null
  onClose: () => void
}

export function ProactiveFeaturePanel({ panel, onClose }: ProactivePanelProps) {
  const [streamingText, setStreamingText] = useState('')
  const [draftText, setDraftText] = useState('')
  const [writingSource, setWritingSource] = useState('')
  const [writingResult, setWritingResult] = useState('')
  const [writingMode, setWritingMode] = useState('rewrite')
  const [customInstruction, setCustomInstruction] = useState('')
  const [actionItems, setActionItems] = useState<
    Array<{
      id: string
      text: string
      owner: string | null
      deadline: string | null
      priority: string
      completed: boolean
    }>
  >([])

  useEffect(() => {
    if (!panel) {
      setStreamingText('')
      setDraftText('')
      setWritingSource('')
      setWritingResult('')
      setActionItems([])
      return
    }

    if (panel.kind === 'writing') {
      setWritingSource(panel.sourceText)
      setWritingResult(panel.result)
      setWritingMode(panel.mode)
    }
    if (panel.kind === 'draft') {
      setDraftText(panel.text)
    }
    if (panel.kind === 'action_items') {
      setActionItems(panel.items)
    }
  }, [panel])

  useEffect(() => {
    const onChunk = (p: unknown) => {
      const data = p as { requestId?: string; text?: string }
      if (data?.text) setStreamingText((prev) => prev + data.text)
    }
    const onDone = (p: unknown) => {
      const data = p as { text?: string }
      if (data?.text) {
        setStreamingText('')
        if (panel?.kind === 'draft') setDraftText(data.text)
        if (panel?.kind === 'writing') setWritingResult(data.text)
      }
    }
    window.electronAPI.on('proactive:stream-chunk', onChunk)
    window.electronAPI.on('proactive:stream-done', onDone)
  }, [panel?.kind])

  if (!panel) return null

  const copyText = (text: string) => void navigator.clipboard.writeText(text)

  if (panel.kind === 'summary') {
    return (
      <div className="proactive-panel proactive-summary-panel">
        <div className="proactive-panel-header">
          <strong>Summary</strong>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        {panel.result.takeaway ? (
          <p className="proactive-summary-takeaway">{panel.result.takeaway}</p>
        ) : null}
        <ul className="proactive-summary-bullets">
          {panel.result.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        {panel.result.decisions.length > 0 ? (
          <>
            <div className="proactive-writing-label">Decisions</div>
            <ul className="proactive-summary-bullets">
              {panel.result.decisions.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </>
        ) : null}
        {panel.result.openQuestions.length > 0 ? (
          <>
            <div className="proactive-writing-label">Open questions</div>
            <ul className="proactive-summary-bullets">
              {panel.result.openQuestions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </>
        ) : null}
        <div className="proactive-panel-actions">
          <button type="button" onClick={() => copyText(panel.result.markdown)}>
            Copy summary
          </button>
        </div>
      </div>
    )
  }

  if (panel.kind === 'action_items') {
    return (
      <div className="proactive-panel proactive-actions-panel">
        <div className="proactive-panel-header">
          <strong>Action items</strong>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <ul className="proactive-action-checklist">
          {actionItems.map((item) => (
            <li key={item.id} className={item.completed ? 'completed' : ''}>
              <label>
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => {
                    void window.electronAPI
                      .invoke('proactive:action-item-complete', { id: item.id })
                      .then(() => {
                        setActionItems((prev) =>
                          prev.map((i) =>
                            i.id === item.id ? { ...i, completed: true } : i,
                          ),
                        )
                      })
                  }}
                />
                <span>{item.text}</span>
              </label>
              {item.owner ? <span className="proactive-item-meta">{item.owner}</span> : null}
              {item.deadline ? (
                <span className="proactive-item-meta">{item.deadline}</span>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="proactive-panel-actions">
          <button
            type="button"
            onClick={() =>
              copyText(actionItems.map((i) => `- [ ] ${i.text}`).join('\n'))
            }
          >
            Copy list
          </button>
        </div>
      </div>
    )
  }

  if (panel.kind === 'draft') {
    const display = streamingText || draftText
    return (
      <div className="proactive-panel proactive-draft-panel">
        <div className="proactive-panel-header">
          <strong>Draft</strong>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <textarea
          className="proactive-draft-editor"
          value={display}
          onChange={(e) => setDraftText(e.target.value)}
          rows={8}
        />
        <div className="proactive-panel-actions">
          {(['professional', 'friendly', 'direct', 'formal'] as const).map((tone) => (
            <button
              key={tone}
              type="button"
              onClick={() =>
                void window.electronAPI.invoke('proactive:draft-generate', { tone })
              }
            >
              {tone}
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              void window.electronAPI.invoke('proactive:writing-transform', {
                text: display,
                mode: 'shorten',
              })
            }
          >
            Shorter
          </button>
          <button
            type="button"
            onClick={() =>
              void window.electronAPI.invoke('proactive:writing-transform', {
                text: display,
                mode: 'expand',
              })
            }
          >
            Longer
          </button>
          <button type="button" onClick={() => copyText(display)}>
            Copy
          </button>
          <button
            type="button"
            onClick={() =>
              void window.electronAPI.invoke('proactive:draft-export-gmail', {
                body: display,
                subject:
                  panel.goal === 'follow_up'
                    ? 'Follow up'
                    : panel.goal === 'share_update'
                      ? 'Update'
                      : undefined,
              })
            }
          >
            Open in Gmail
          </button>
        </div>
      </div>
    )
  }

  const displayResult = streamingText || writingResult
  return (
    <div className="proactive-panel proactive-writing-panel">
      <div className="proactive-panel-header">
        <strong>Writing assistant</strong>
        <button type="button" onClick={onClose}>Close</button>
      </div>
      <div className="proactive-writing-columns">
        <div>
          <div className="proactive-writing-label">Before</div>
          <pre className="proactive-writing-text">{writingSource}</pre>
        </div>
        <div>
          <div className="proactive-writing-label">After</div>
          <pre className="proactive-writing-text">{displayResult}</pre>
        </div>
      </div>
      <div className="proactive-writing-modes">
        {(['rewrite', 'shorten', 'expand', 'formal', 'casual', 'grammar'] as const).map(
          (mode) => (
            <button
              key={mode}
              type="button"
              className={writingMode === mode ? 'active' : ''}
              onClick={() => {
                setWritingMode(mode)
                void window.electronAPI.invoke('proactive:writing-transform', {
                  text: writingSource,
                  mode,
                })
              }}
            >
              {mode}
            </button>
          ),
        )}
      </div>
      <input
        className="proactive-custom-instruction"
        placeholder="Custom instruction…"
        value={customInstruction}
        onChange={(e) => setCustomInstruction(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            void window.electronAPI.invoke('proactive:writing-transform', {
              text: writingSource,
              mode: writingMode,
              customInstruction,
            })
          }
        }}
      />
      <div className="proactive-panel-actions">
        <button type="button" onClick={() => copyText(displayResult)}>
          Copy to clipboard
        </button>
      </div>
    </div>
  )
}

export function useProactivePanel() {
  const [panel, setPanel] = useState<ProactivePanelPayload | null>(null)

  useEffect(() => {
    window.electronAPI.on('proactive:panel-update', (p) => {
      setPanel((p as ProactivePanelPayload | null) ?? null)
    })
  }, [])

  const closePanel = useCallback(() => {
    void window.electronAPI.invoke('proactive:panel-close')
    setPanel(null)
  }, [])

  const runAction = useCallback(async (action: ProactiveSuggestedAction) => {
    await window.electronAPI.invoke('proactive:run-action', { action })
  }, [])

  return { panel, closePanel, runAction }
}
