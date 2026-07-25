import { useMemo } from 'react'

import { formatBullets, parseEnhancedSections } from '../lib/parseEnhancedNotes'
import { useToast } from '../hooks/useToast'
import { StatefulButton } from './ui/StatefulButton'
import type { Meeting } from '../types/meeting'

type EnhancedNotesPanelProps = {
  meeting: Meeting
  onRegenerate: () => void
}

export function EnhancedNotesPanel({ meeting, onRegenerate }: EnhancedNotesPanelProps) {
  const { toast } = useToast()
  const source = meeting.enhancedNotes || meeting.summary || ''
  const sections = useMemo(() => parseEnhancedSections(source), [source])

  const copySummary = async () => {
    const parts: string[] = []
    for (const section of sections) {
      parts.push(`## ${section.title}`, section.body, '')
    }
    if (meeting.actionItems && meeting.actionItems.length > 0) {
      parts.push('## Action items', ...meeting.actionItems.map((item) => `- ${item}`))
    }
    await navigator.clipboard.writeText(parts.join('\n').trim() || 'No summary yet.')
    toast('Summary copied')
  }

  return (
    <section className="enhanced-panel artifact-summary-panel">
      <div className="artifact-doc-toolbar">
        <StatefulButton
          variant="link"
          idleLabel="Copy"
          successLabel="Copied"
          successDuration={1600}
          onClick={copySummary}
          className="artifact-doc-copy"
        />
        <StatefulButton
          variant="link"
          idleLabel="Regenerate"
          loadingLabel="Regenerating…"
          successLabel="Queued"
          successDuration={1200}
          className="artifact-doc-copy"
          onClick={async () => {
            onRegenerate()
            toast('Regenerating summary')
          }}
        />
      </div>

      {!source ? (
        <p className="artifact-empty">Enhanced notes will appear here after the meeting.</p>
      ) : (
        <article className="artifact-summary-doc">
          {sections.map((section) => {
            const bullets = formatBullets(section.body)
            const useList = bullets.length > 1 || /^[-*•]/.test(section.body.trim())
            return (
              <section key={section.id} className="artifact-summary-section">
                <h3 className="artifact-summary-heading">
                  <span className="artifact-summary-hash" aria-hidden>
                    #
                  </span>
                  {section.title}
                </h3>
                {useList ? (
                  <ul className="artifact-summary-list">
                    {bullets.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="artifact-summary-body">{section.body}</p>
                )}
              </section>
            )
          })}
        </article>
      )}
    </section>
  )
}
