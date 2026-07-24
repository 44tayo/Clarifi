import { useMemo, useState } from 'react'

import type { TranscriptEntry } from '../types/meeting'

type TranscriptPanelProps = {
  entries: TranscriptEntry[]
  activity: string
  live: boolean
  speakerLabels?: Record<string, string>
  startedAt?: number
  onRenameSpeaker?: (speakerKey: string, label: string) => void
  hideHeader?: boolean
}

type TranscriptBlock = {
  speaker: string
  entries: TranscriptEntry[]
  startAt: number
  endAt: number
}

function displaySpeaker(speaker: string, labels?: Record<string, string>): string {
  return labels?.[speaker]?.trim() || speaker
}

function formatOffset(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function groupBlocks(entries: TranscriptEntry[]): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = []
  for (const entry of entries) {
    const last = blocks[blocks.length - 1]
    if (last && last.speaker === entry.speaker) {
      last.entries.push(entry)
      last.endAt = entry.at
    } else {
      blocks.push({
        speaker: entry.speaker,
        entries: [entry],
        startAt: entry.at,
        endAt: entry.at,
      })
    }
  }
  return blocks
}

export function TranscriptPanel({
  entries,
  activity,
  live,
  speakerLabels,
  startedAt,
  onRenameSpeaker,
  hideHeader = false,
}: TranscriptPanelProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const blocks = useMemo(() => groupBlocks(entries), [entries])
  const uniqueSpeakers = [...new Set(entries.map((entry) => entry.speaker))]
  const origin = startedAt ?? entries[0]?.at ?? 0

  const startEdit = (speaker: string) => {
    if (!onRenameSpeaker) return
    setEditing(speaker)
    setDraft(displaySpeaker(speaker, speakerLabels))
  }

  const commit = () => {
    if (!editing || !onRenameSpeaker) return
    const label = draft.trim()
    if (label) onRenameSpeaker(editing, label)
    setEditing(null)
  }

  return (
    <section className={`transcript-pane${hideHeader ? ' is-embedded' : ''}`}>
      {!hideHeader ? (
        <div className="pane-header">
          Transcript {live ? `· ${activity}` : ''}
          {onRenameSpeaker && uniqueSpeakers.length > 0 ? (
            <span className="transcript-rename-hint">Click a speaker to rename</span>
          ) : null}
        </div>
      ) : null}
      <div className="transcript-scroll">
        {entries.length === 0 ? (
          <p className="transcript-empty">
            {live
              ? 'Listening for speech from your mic and meeting audio…'
              : 'No transcript captured for this meeting.'}
          </p>
        ) : (
          <div className="transcript-doc">
            {blocks.map((block) => {
              const joined = block.entries
                .map((entry) => entry.text.trim())
                .filter(Boolean)
                .join(' ')
              return (
                <div
                  key={`${block.speaker}-${block.startAt}-${block.entries[0]?.id}`}
                  className="transcript-block"
                >
                  <div className="transcript-block-head">
                    {editing === block.speaker ? (
                      <input
                        className="transcript-rename-input"
                        value={draft}
                        autoFocus
                        onChange={(event) => setDraft(event.target.value)}
                        onBlur={commit}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            commit()
                          }
                          if (event.key === 'Escape') setEditing(null)
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className={`transcript-speaker-btn${onRenameSpeaker ? ' is-editable' : ''}`}
                        onClick={() => startEdit(block.speaker)}
                        disabled={!onRenameSpeaker}
                      >
                        {displaySpeaker(block.speaker, speakerLabels)}
                      </button>
                    )}
                    <span className="transcript-block-time">
                      {formatOffset(block.startAt - origin)} – {formatOffset(block.endAt - origin)}
                    </span>
                  </div>
                  <p className="transcript-block-body">{joined}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
