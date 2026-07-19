import { useMemo, useState } from 'react'

import type { Meeting } from '../types/meeting'

type EnhancedNotesPanelProps = {
  meeting: Meeting
  onRegenerate: () => void
}

export function EnhancedNotesPanel({ meeting }: EnhancedNotesPanelProps) {
  const [copied, setCopied] = useState(false)

  const body = useMemo(() => {
    return meeting.enhancedNotes || meeting.summary || 'Enhanced notes will appear here.'
  }, [meeting.enhancedNotes, meeting.summary])

  const copySummary = async () => {
    const parts = [body]
    if (meeting.actionItems && meeting.actionItems.length > 0) {
      parts.push('', 'Action items:', ...meeting.actionItems.map((item) => `- ${item}`))
    }
    await navigator.clipboard.writeText(parts.join('\n'))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <section className="enhanced-panel">
      <div className="enhanced-panel-toolbar">
        <button type="button" className="btn btn-secondary" onClick={() => void copySummary()}>
          {copied ? 'Copied' : 'Copy summary'}
        </button>
      </div>

      {meeting.actionItems && meeting.actionItems.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <div className="pane-header" style={{ paddingLeft: 0 }}>
            Action items
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ds-text-primary)' }}>
            {meeting.actionItems.map((item) => (
              <li key={item} style={{ marginBottom: 6 }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="enhanced-markdown">{body}</div>
    </section>
  )
}
