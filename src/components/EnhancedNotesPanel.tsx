import { useMemo, useState } from 'react'

import type { Meeting } from '../types/meeting'

type EnhancedNotesPanelProps = {
  meeting: Meeting
  onRegenerate: () => void
}

export function EnhancedNotesPanel({ meeting, onRegenerate }: EnhancedNotesPanelProps) {
  const [tab, setTab] = useState<'enhanced' | 'raw'>('enhanced')

  const body = useMemo(() => {
    if (tab === 'raw') return meeting.userNotes || '(no notes taken)'
    return meeting.enhancedNotes || meeting.summary || 'Enhanced notes will appear here.'
  }, [meeting.enhancedNotes, meeting.summary, meeting.userNotes, tab])

  return (
    <section className="enhanced-panel">
      <div className="enhanced-tabs">
        <button
          type="button"
          className={`tab-btn${tab === 'enhanced' ? ' is-active' : ''}`}
          onClick={() => setTab('enhanced')}
        >
          Enhanced notes
        </button>
        <button
          type="button"
          className={`tab-btn${tab === 'raw' ? ' is-active' : ''}`}
          onClick={() => setTab('raw')}
        >
          Raw notes
        </button>
        {meeting.status === 'ready' || meeting.status === 'error' ? (
          <button type="button" className="tab-btn" onClick={onRegenerate}>
            Regenerate
          </button>
        ) : null}
      </div>

      {meeting.status === 'processing' ? (
        <div className="processing-banner">Enhancing your notes with AI…</div>
      ) : null}

      {meeting.status === 'error' ? (
        <div className="processing-banner" style={{ background: '#fef2f2', color: '#b91c1c' }}>
          Enhancement failed{meeting.enhanceError ? `: ${meeting.enhanceError}` : ''}. Try again.
        </div>
      ) : null}

      {meeting.actionItems && meeting.actionItems.length > 0 && tab === 'enhanced' ? (
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
