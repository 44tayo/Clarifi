import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import {
  parseEnhancedSections,
  parseMarkdownBlocks,
  type MdInline,
  type MdListItem,
} from '../lib/parseEnhancedNotes'
import { claimKey, flattenInlineText, serializeSummaryDom } from '../lib/summaryDom'
import { useToast } from '../hooks/useToast'
import { MEETING_TEMPLATES, type MeetingTemplateId } from '../../shared/meetingTemplates'
import { DropdownSelect } from './ui/DropdownSelect'
import { StatefulButton } from './ui/StatefulButton'
import type { Meeting } from '../types/meeting'

type EnhancedNotesPanelProps = {
  meeting: Meeting
  paired: boolean
  onConnect: () => void
  onChangeTemplate: (templateId: MeetingTemplateId) => void
  onOpenTranscript?: () => void
  onUpdateNotes: (enhancedNotes: string) => void
  onCacheEvidence: (claim: string, summary: string) => void
  onAskWithSelection?: (selection: string, mode: 'chat' | 'quick-edit') => void
}

type ToolbarState = {
  top: number
  left: number
  text: string
}

type EvidenceState = {
  claim: string
  summary: string | null
  loading: boolean
  error: string | null
  top: number
  left: number
}

const EVIDENCE_POPOVER_WIDTH = 360

function positionEvidencePopover(anchor: DOMRect): { top: number; left: number } {
  const gap = 8
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(EVIDENCE_POPOVER_WIDTH, vw - 32)
  const left = Math.min(Math.max(16, anchor.right - width), vw - width - 16)

  const spaceBelow = vh - anchor.bottom - gap
  const spaceAbove = anchor.top - gap
  const preferAbove = spaceBelow < 180 && spaceAbove > spaceBelow
  const top = preferAbove
    ? Math.max(8, anchor.top - Math.min(280, spaceAbove) - gap)
    : Math.min(anchor.bottom + gap, vh - 120)

  return { top, left }
}

function renderInlines(nodes: MdInline[]): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${node.type}-${index}`
    switch (node.type) {
      case 'bold':
        return <strong key={key}>{node.text}</strong>
      case 'italic':
        return <em key={key}>{node.text}</em>
      case 'code':
        return (
          <code key={key} className="artifact-summary-code">
            {node.text}
          </code>
        )
      case 'link':
        return (
          <a key={key} href={node.href} className="artifact-summary-link">
            {node.text}
          </a>
        )
      default:
        return <span key={key}>{node.text}</span>
    }
  })
}

function MagnifierIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.2 10.2 13.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

type ClaimRowProps = {
  claim: string
  children: ReactNode
  nested?: ReactNode
  onEvidence: (claim: string, anchorEl: HTMLElement) => void
}

function ClaimRow({ claim, children, nested, onEvidence }: ClaimRowProps) {
  return (
    <li className="artifact-claim-row" data-claim={claim}>
      <div className="artifact-claim-main">
        <span className="artifact-claim-text">{children}</span>
        <button
          type="button"
          className="artifact-evidence-btn"
          aria-label="Show transcript summary for this point"
          title="Transcript summary"
          contentEditable={false}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onEvidence(claim, event.currentTarget)
          }}
        >
          <MagnifierIcon />
        </button>
      </div>
      {nested}
    </li>
  )
}

function SummaryListItems({
  items,
  onEvidence,
}: {
  items: MdListItem[]
  onEvidence: (claim: string, anchorEl: HTMLElement) => void
}) {
  return (
    <ul className="artifact-summary-list">
      {items.map((item, index) => {
        const claim = flattenInlineText(item.children)
        return (
          <ClaimRow
            key={`${claim}-${index}`}
            claim={claim}
            onEvidence={onEvidence}
            nested={
              item.nested && item.nested.length > 0 ? (
                <SummaryListItems items={item.nested} onEvidence={onEvidence} />
              ) : null
            }
          >
            {renderInlines(item.children)}
          </ClaimRow>
        )
      })}
    </ul>
  )
}

function SummarySectionBody({
  body,
  onEvidence,
}: {
  body: string
  onEvidence: (claim: string, anchorEl: HTMLElement) => void
}) {
  const blocks = useMemo(() => parseMarkdownBlocks(body), [body])
  if (blocks.length === 0) return null

  return (
    <div className="artifact-summary-blocks">
      {blocks.map((block, index) => {
        if (block.type === 'list') {
          return <SummaryListItems key={index} items={block.items} onEvidence={onEvidence} />
        }
        if (block.type === 'blockquote') {
          return (
            <blockquote key={index} className="artifact-summary-callout">
              {renderInlines(block.children)}
            </blockquote>
          )
        }
        return (
          <p key={index} className="artifact-summary-body">
            {renderInlines(block.children)}
          </p>
        )
      })}
    </div>
  )
}

const EVIDENCE_PROMPT = (claim: string) =>
  [
    'You are writing a TRANSCRIPT SUMMARY that explains why a specific claim appears in the meeting notes.',
    'Use ONLY the meeting transcript (and notes) provided in context.',
    'Write 1 short paragraph that paraphrases the relevant discussion and includes 1–3 short direct quotes from the transcript when available.',
    'Do not invent facts. Do not use markdown headings. Do not say "here is a summary".',
    'No em-dashes.',
    '',
    `Claim from the notes:\n"${claim}"`,
  ].join('\n')

export function EnhancedNotesPanel({
  meeting,
  paired,
  onConnect,
  onChangeTemplate,
  onOpenTranscript,
  onUpdateNotes,
  onCacheEvidence,
  onAskWithSelection,
}: EnhancedNotesPanelProps) {
  const { toast } = useToast()
  const source = meeting.enhancedNotes || meeting.summary || ''
  const sections = useMemo(() => parseEnhancedSections(source), [source])
  const docRef = useRef<HTMLElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null)
  const [evidence, setEvidence] = useState<EvidenceState | null>(null)
  const evidenceAnchorRef = useRef<HTMLElement | null>(null)

  const copySummary = async () => {
    const parts: string[] = []
    for (const section of sections) {
      parts.push(`# ${section.title}`, section.body, '')
    }
    if (meeting.actionItems && meeting.actionItems.length > 0) {
      const hasNextSteps = sections.some((s) => s.title.toLowerCase() === 'next steps')
      if (!hasNextSteps) {
        parts.push('# Next Steps', ...meeting.actionItems.map((item) => `- ${item}`))
      }
    }
    await navigator.clipboard.writeText(parts.join('\n').trim() || 'No summary yet.')
  }

  const persistFromDom = useCallback(() => {
    const root = docRef.current
    if (!root) return
    const next = serializeSummaryDom(root)
    if (!next || next === (meeting.enhancedNotes || '').trim()) return
    onUpdateNotes(next)
  }, [meeting.enhancedNotes, onUpdateNotes])

  const schedulePersist = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      persistFromDom()
    }, 700)
  }, [persistFromDom])

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    },
    [],
  )

  const updateToolbarFromSelection = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !docRef.current) {
      setToolbar(null)
      return
    }
    if (!docRef.current.contains(sel.anchorNode)) {
      setToolbar(null)
      return
    }
    const text = sel.toString().trim()
    if (!text) {
      setToolbar(null)
      return
    }
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      setToolbar(null)
      return
    }
    setToolbar({
      text,
      top: Math.max(8, rect.top - 44),
      left: Math.min(
        Math.max(rect.left + rect.width / 2, 120),
        window.innerWidth - 120,
      ),
    })
  }, [])

  useEffect(() => {
    const onSel = () => updateToolbarFromSelection()
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [updateToolbarFromSelection])

  const runFormat = (command: 'bold' | 'italic' | 'underline' | 'strikeThrough') => {
    document.execCommand(command)
    schedulePersist()
    updateToolbarFromSelection()
  }

  const openEvidence = useCallback(
    async (claim: string, anchorEl: HTMLElement) => {
      const key = claimKey(claim)
      const cached = meeting.evidenceCache?.[key]
      evidenceAnchorRef.current = anchorEl
      const { top, left } = positionEvidencePopover(anchorEl.getBoundingClientRect())

      if (cached) {
        setEvidence({ claim, summary: cached, loading: false, error: null, top, left })
        return
      }
      if (!paired) {
        onConnect()
        setEvidence({
          claim,
          summary: null,
          loading: false,
          error: 'Connect your account to see transcript summaries.',
          top,
          left,
        })
        return
      }

      setEvidence({ claim, summary: null, loading: true, error: null, top, left })
      try {
        const result = (await window.electronAPI.invoke('chat:send', {
          message: EVIDENCE_PROMPT(claim),
          meetingId: meeting.id,
          scope: 'meeting',
          effort: 'medium',
        })) as { reply?: string; error?: string }

        if (result.error || !result.reply?.trim()) {
          setEvidence((prev) =>
            prev && prev.claim === claim
              ? {
                  ...prev,
                  loading: false,
                  error: 'Could not load transcript summary. Try again.',
                }
              : prev,
          )
          return
        }
        const summary = result.reply.trim()
        onCacheEvidence(key, summary)
        setEvidence((prev) =>
          prev && prev.claim === claim
            ? { ...prev, summary, loading: false, error: null }
            : prev,
        )
      } catch {
        setEvidence((prev) =>
          prev && prev.claim === claim
            ? {
                ...prev,
                loading: false,
                error: 'Could not load transcript summary. Try again.',
              }
            : prev,
        )
      }
    },
    [meeting.evidenceCache, meeting.id, onCacheEvidence, onConnect, paired],
  )

  useEffect(() => {
    if (!evidence) {
      evidenceAnchorRef.current = null
      return
    }
    const reposition = () => {
      const el = evidenceAnchorRef.current
      if (!el || !el.isConnected) return
      const next = positionEvidencePopover(el.getBoundingClientRect())
      setEvidence((prev) =>
        prev && (prev.top !== next.top || prev.left !== next.left)
          ? { ...prev, ...next }
          : prev,
      )
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [evidence?.claim])

  useEffect(() => {
    if (!evidence) return
    const onDoc = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.artifact-evidence-popover')) return
      if (target?.closest('.artifact-evidence-btn')) return
      setEvidence(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEvidence(null)
    }
    window.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [evidence])

  return (
    <section className="enhanced-panel artifact-summary-panel">
      <div className="artifact-reading-column">
        <div className="artifact-doc-toolbar">
          <StatefulButton
            variant="link"
            idleLabel="Copy"
            successLabel="Copied"
            successDuration={1600}
            onClick={copySummary}
            className="artifact-doc-copy"
            icon={
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <rect
                  x="5.5"
                  y="5.5"
                  width="7"
                  height="8"
                  rx="1.2"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M10.5 5.5V4.2A1.2 1.2 0 0 0 9.3 3H4.2A1.2 1.2 0 0 0 3 4.2v5.1A1.2 1.2 0 0 0 4.2 10.5H5.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            }
          />
          <div className="artifact-doc-template-select">
            <DropdownSelect
              value={meeting.templateId ?? 'general'}
              options={MEETING_TEMPLATES.map((template) => ({
                value: template.id,
                label: template.label,
              }))}
              onChange={(value) => {
                onChangeTemplate(value as MeetingTemplateId)
                toast('Regenerating with new template')
              }}
              aria-label="Meeting type"
            />
          </div>
        </div>

        {!source ? (
          <p className="artifact-empty">Enhanced notes will appear here after the meeting.</p>
        ) : (
          <article
            ref={docRef}
            className="artifact-summary-doc is-editable"
            contentEditable
            suppressContentEditableWarning
            spellCheck
            onInput={schedulePersist}
            onBlur={persistFromDom}
            onMouseUp={updateToolbarFromSelection}
            onKeyUp={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
                event.preventDefault()
                const text = window.getSelection()?.toString().trim()
                if (text) onAskWithSelection?.(text, 'quick-edit')
              }
            }}
          >
            {sections.map((section) => (
              <section key={section.id} className="artifact-summary-section">
                <h3 className="artifact-summary-heading">
                  <span className="artifact-summary-hash" aria-hidden>
                    #
                  </span>
                  <span className="artifact-summary-title">{section.title}</span>
                </h3>
                <SummarySectionBody body={section.body} onEvidence={openEvidence} />
              </section>
            ))}
            {onOpenTranscript ? (
              <p className="artifact-summary-footer" contentEditable={false}>
                <button type="button" className="link-btn" onClick={onOpenTranscript}>
                  Chat with meeting transcript
                </button>
              </p>
            ) : null}
          </article>
        )}
      </div>

      {toolbar ? (
        <div
          className="artifact-selection-toolbar"
          style={{ top: toolbar.top, left: toolbar.left }}
          onMouseDown={(event: ReactMouseEvent) => event.preventDefault()}
        >
          <button type="button" onClick={() => runFormat('bold')} aria-label="Bold">
            <strong>B</strong>
          </button>
          <button type="button" onClick={() => runFormat('italic')} aria-label="Italic">
            <em>I</em>
          </button>
          <button type="button" onClick={() => runFormat('underline')} aria-label="Underline">
            <span style={{ textDecoration: 'underline' }}>U</span>
          </button>
          <button type="button" onClick={() => runFormat('strikeThrough')} aria-label="Strikethrough">
            <span style={{ textDecoration: 'line-through' }}>S</span>
          </button>
          <span className="artifact-selection-sep" aria-hidden />
          <button
            type="button"
            className="artifact-selection-quick"
            onClick={() => {
              onAskWithSelection?.(toolbar.text, 'quick-edit')
              setToolbar(null)
            }}
          >
            Quick edit <kbd>⌘J</kbd>
          </button>
          <button
            type="button"
            className="artifact-selection-quick"
            onClick={() => {
              onAskWithSelection?.(toolbar.text, 'chat')
              setToolbar(null)
            }}
          >
            Chat
          </button>
        </div>
      ) : null}

      {evidence
        ? createPortal(
            <div
              className="artifact-evidence-popover"
              style={{ top: evidence.top, left: evidence.left }}
              role="dialog"
              aria-label="Transcript summary"
            >
              <div className="artifact-evidence-label">Transcript summary</div>
              {evidence.loading ? (
                <p className="artifact-evidence-body is-muted">Finding supporting transcript…</p>
              ) : evidence.error ? (
                <p className="artifact-evidence-body is-error">{evidence.error}</p>
              ) : (
                <p className="artifact-evidence-body">{evidence.summary}</p>
              )}
            </div>,
            document.body,
          )
        : null}
    </section>
  )
}
