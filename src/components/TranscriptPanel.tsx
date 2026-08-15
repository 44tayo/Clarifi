import { useEffect, useMemo, useRef, useState } from 'react'

import type { TranscriptEntry } from '../types/meeting'
import { resolveTranscriptEntryId } from '../../shared/citationNav'

export type LiveInterimEntry = { text: string; speaker: string }

export type TranscriptHighlight = {
  entryId?: string
  audioStartMs?: number
  quote?: string
}

type TranscriptPanelProps = {
  entries: TranscriptEntry[]
  activity: string
  live: boolean
  speakerLabels?: Record<string, string>
  startedAt?: number
  onRenameSpeaker?: (speakerKey: string, label: string) => void
  hideHeader?: boolean
  /** In-progress (not yet finalized) caption lines, keyed by stream source. */
  interim?: Partial<Record<'mic' | 'system', LiveInterimEntry>>
  highlight?: TranscriptHighlight | null
}

type TranscriptBlock = {
  speaker: string
  entries: TranscriptEntry[]
  startAt: number
  endAt: number
  audioStartMs?: number
  audioEndMs?: number
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

function entryAudioStart(entry: TranscriptEntry): number | undefined {
  return typeof entry.audioStartMs === 'number' ? entry.audioStartMs : undefined
}

function entryAudioEnd(entry: TranscriptEntry): number | undefined {
  if (typeof entry.audioEndMs === 'number') return entry.audioEndMs
  if (typeof entry.audioStartMs === 'number') {
    return entry.audioStartMs + Math.max(800, entry.text.length * 40)
  }
  return undefined
}

/** Jamie/Granola: one paragraph per speaker until a different speaker speaks. */
function groupBlocks(entries: TranscriptEntry[]): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = []
  for (const entry of entries) {
    const last = blocks[blocks.length - 1]
    if (last && last.speaker === entry.speaker) {
      last.entries.push(entry)
      last.endAt = entry.at
      const end = entryAudioEnd(entry)
      if (typeof end === 'number') {
        last.audioEndMs = Math.max(last.audioEndMs ?? end, end)
      }
    } else {
      blocks.push({
        speaker: entry.speaker,
        entries: [entry],
        startAt: entry.at,
        endAt: entry.at,
        audioStartMs: entryAudioStart(entry),
        audioEndMs: entryAudioEnd(entry),
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
  interim,
  highlight = null,
}: TranscriptPanelProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const highlightRef = useRef<HTMLDivElement | null>(null)
  const blocks = useMemo(() => groupBlocks(entries), [entries])
  const origin = startedAt ?? entries[0]?.at ?? 0
  const focusEntryId = useMemo(() => {
    if (!highlight) return null
    return resolveTranscriptEntryId(entries, highlight)
  }, [entries, highlight])
  const interimBlocks = useMemo(
    () =>
      (['mic', 'system'] as const)
        .map((source) => interim?.[source])
        .filter((value): value is LiveInterimEntry => Boolean(value?.text.trim())),
    [interim],
  )

  useEffect(() => {
    if (!focusEntryId || !highlightRef.current) return
    highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusEntryId])

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
        </div>
      ) : null}
      <div className="transcript-scroll">
        {entries.length === 0 && interimBlocks.length === 0 ? (
          <p className="transcript-empty">
            {live
              ? 'Listening for speech…'
              : 'No transcript captured for this meeting.'}
          </p>
        ) : (
          <div className="transcript-doc">
            {blocks.map((block) => {
              const joined = block.entries
                .map((entry) => entry.text.trim())
                .filter(Boolean)
                .join(' ')
              const isHighlighted = Boolean(
                focusEntryId && block.entries.some((entry) => entry.id === focusEntryId),
              )
              return (
                <div
                  key={`${block.speaker}-${block.startAt}-${block.entries[0]?.id}`}
                  ref={isHighlighted ? highlightRef : undefined}
                  className={`transcript-block${isHighlighted ? ' is-citation-focus' : ''}`}
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
                        title={onRenameSpeaker ? 'Rename speaker' : undefined}
                      >
                        {displaySpeaker(block.speaker, speakerLabels)}
                      </button>
                    )}
                    <span className="transcript-block-time">
                      {typeof block.audioStartMs === 'number'
                        ? `${formatOffset(block.audioStartMs)}${
                            typeof block.audioEndMs === 'number' &&
                            block.audioEndMs > block.audioStartMs
                              ? ` – ${formatOffset(block.audioEndMs)}`
                              : ''
                          }`
                        : `${formatOffset(block.startAt - origin)}${
                            block.endAt > block.startAt
                              ? ` – ${formatOffset(block.endAt - origin)}`
                              : ''
                          }`}
                    </span>
                  </div>
                  <p className="transcript-block-body">{joined}</p>
                </div>
              )
            })}
            {interimBlocks.map((entry, index) => (
              <div key={`interim-${index}-${entry.speaker}`} className="transcript-block is-interim">
                <div className="transcript-block-head">
                  <span className="transcript-speaker-btn" aria-disabled="true">
                    {displaySpeaker(entry.speaker, speakerLabels)}
                  </span>
                  <span className="transcript-block-time transcript-live-badge">live</span>
                </div>
                <p className="transcript-block-body">
                  {entry.text}
                  <span className="transcript-live-cursor" aria-hidden="true" />
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
