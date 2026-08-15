import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { speakerColor } from '../../lib/speakerColors'
import type { TranscriptEntry } from '../../types/meeting'
import { AudioSessionWaveform } from './AudioSessionWaveform'
import { ClarifiLogoMark } from './ClarifiLogoMark'

export type WidgetPanel = 'notepad' | 'transcript'
export type WidgetLiveInterim = { text: string; speaker: string }

type WidgetNotepadPanelProps = {
  title: string
  elapsed: string
  recording: boolean
  paused: boolean
  activity: string
  panel: WidgetPanel
  notes: string
  transcript: TranscriptEntry[]
  speakerLabels: Record<string, string>
  interim?: Partial<Record<'mic' | 'system', WidgetLiveInterim>>
  onPanelChange: (panel: WidgetPanel) => void
  onNotesChange: (notes: string) => void
  onCollapse: () => void
  onMaximize: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onRenameSpeaker: (canonical: string, displayName: string) => void
}

type TranscriptBlock = {
  speaker: string
  entries: TranscriptEntry[]
}

function MaximizeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6 2.5H2.5V6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function formatSessionStamp(at = Date.now()): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(at)
}

function groupTranscript(entries: TranscriptEntry[]): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = []
  for (const entry of entries) {
    const last = blocks[blocks.length - 1]
    if (last && last.speaker === entry.speaker) {
      last.entries.push(entry)
    } else {
      blocks.push({ speaker: entry.speaker, entries: [entry] })
    }
  }
  return blocks
}

export function WidgetNotepadPanel({
  title,
  elapsed,
  recording,
  paused,
  activity,
  panel,
  notes,
  transcript,
  speakerLabels,
  interim,
  onPanelChange,
  onNotesChange,
  onCollapse,
  onMaximize,
  onPause,
  onResume,
  onStop,
  onRenameSpeaker,
}: WidgetNotepadPanelProps) {
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const transcriptScrollRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const [sessionStamp] = useState(() => formatSessionStamp())

  const displayName = useCallback(
    (speaker: string) => speakerLabels[speaker]?.trim() || speaker,
    [speakerLabels],
  )

  const blocks = useMemo(() => groupTranscript(transcript), [transcript])

  const interimEntries = useMemo(
    () =>
      (['mic', 'system'] as const)
        .map((source) => interim?.[source])
        .filter((value): value is WidgetLiveInterim => Boolean(value?.text.trim())),
    [interim],
  )

  const uniqueSpeakers = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    for (const entry of transcript) {
      if (!seen.has(entry.speaker)) {
        seen.add(entry.speaker)
        list.push(entry.speaker)
      }
    }
    return list
  }, [transcript])

  const beginRename = (speaker: string) => {
    setEditingSpeaker(speaker)
    setDraftName(displayName(speaker))
  }

  const commitRename = () => {
    if (editingSpeaker && draftName.trim()) {
      onRenameSpeaker(editingSpeaker, draftName.trim())
    }
    setEditingSpeaker(null)
    setDraftName('')
  }

  const handleTranscriptScroll = () => {
    const el = transcriptScrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottomRef.current = distanceFromBottom < 48
  }

  useEffect(() => {
    if (panel !== 'transcript') return
    if (!stickToBottomRef.current) return
    const el = transcriptScrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [transcript, interimEntries, panel])

  const showWave = recording && !paused && activity !== 'silent'

  return (
    <div className="widget-panel">
      <div className="widget-panel-header">
        <button
          type="button"
          className="widget-logo-btn widget-logo-btn--sm"
          onClick={onCollapse}
          aria-label="Minimize to bar"
        >
          <ClarifiLogoMark className="widget-logo-img" />
        </button>
        {recording && !paused ? <span className="widget-rec-dot" aria-hidden /> : null}
        <span className="widget-panel-title">{title}</span>
        <div className="widget-panel-header-icons">
          <div className="widget-live-tabs" role="tablist" aria-label="Widget panels">
            <button
              type="button"
              role="tab"
              aria-selected={panel === 'notepad'}
              className={`widget-live-tab${panel === 'notepad' ? ' is-active' : ''}`}
              onClick={() => onPanelChange('notepad')}
            >
              Scratchpad
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={panel === 'transcript'}
              className={`widget-live-tab${panel === 'transcript' ? ' is-active' : ''}`}
              onClick={() => onPanelChange('transcript')}
            >
              Transcript
            </button>
          </div>
          <button type="button" className="widget-icon-btn" aria-label="Open meeting" onClick={onMaximize}>
            <MaximizeIcon />
          </button>
        </div>
      </div>

      <div className="widget-panel-body">
        {panel === 'notepad' ? (
          <div className="widget-notes-canvas">
            <p className="widget-notes-stamp">{sessionStamp}</p>
            <textarea
              className="widget-panel-notes"
              placeholder="Write private notes…"
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              aria-label="Private notes"
            />
          </div>
        ) : (
          <div className="widget-transcript-view">
            {uniqueSpeakers.length > 0 ? (
              <div className="widget-speaker-strip" aria-label="Speakers">
                {uniqueSpeakers.map((speaker) => (
                  <button
                    key={speaker}
                    type="button"
                    className="widget-speaker-pill"
                    style={{ ['--speaker-color' as string]: speakerColor(speaker) }}
                    onClick={() => beginRename(speaker)}
                    title="Rename speaker"
                  >
                    <span className="widget-speaker-pill-dot" aria-hidden />
                    {displayName(speaker)}
                  </button>
                ))}
              </div>
            ) : null}
            <div
              className="widget-panel-transcript"
              ref={transcriptScrollRef}
              onScroll={handleTranscriptScroll}
            >
              {blocks.length === 0 && interimEntries.length === 0 ? (
                <div className="widget-transcript-empty">
                  <AudioSessionWaveform active={showWave} size="md" />
                  <p className="widget-empty">
                    {paused ? 'Recording paused' : 'Listening for speech…'}
                  </p>
                  <p className="widget-empty-hint">
                    Speakers are labeled automatically. Tap a name to rename.
                  </p>
                </div>
              ) : (
                blocks.map((block) => (
                  <article key={`${block.speaker}-${block.entries[0]!.id}`} className="widget-transcript-block">
                    <header className="widget-transcript-block-header">
                      <span
                        className="widget-speaker-avatar"
                        style={{ background: speakerColor(block.speaker) }}
                        aria-hidden
                      >
                        {displayName(block.speaker).slice(0, 1).toUpperCase()}
                      </span>
                      {editingSpeaker === block.speaker ? (
                        <input
                          className="widget-speaker-input"
                          value={draftName}
                          onChange={(event) => setDraftName(event.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') commitRename()
                            if (event.key === 'Escape') setEditingSpeaker(null)
                          }}
                          autoFocus
                          aria-label="Speaker name"
                        />
                      ) : (
                        <button
                          type="button"
                          className="widget-speaker-name"
                          onClick={() => beginRename(block.speaker)}
                          title="Rename speaker"
                        >
                          {displayName(block.speaker)}
                        </button>
                      )}
                      <span className="widget-transcript-source">
                        {block.entries[0]!.source === 'mic' ? 'You' : 'Meeting'}
                      </span>
                    </header>
                    <div className="widget-transcript-block-body">
                      {block.entries.map((entry) => (
                        <p key={entry.id} className="widget-transcript-line">
                          {entry.text}
                        </p>
                      ))}
                    </div>
                  </article>
                ))
              )}
              {interimEntries.map((entry, index) => (
                <article
                  key={`interim-${index}-${entry.speaker}`}
                  className="widget-transcript-block is-interim"
                >
                  <header className="widget-transcript-block-header">
                    <span
                      className="widget-speaker-avatar"
                      style={{ background: speakerColor(entry.speaker) }}
                      aria-hidden
                    >
                      {displayName(entry.speaker).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="widget-speaker-name" aria-disabled="true">
                      {displayName(entry.speaker)}
                    </span>
                    <span className="widget-transcript-live-badge">live</span>
                  </header>
                  <div className="widget-transcript-block-body">
                    <p className="widget-transcript-line">
                      {entry.text}
                      <span className="transcript-live-cursor" aria-hidden="true" />
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="widget-panel-footer">
        <span className="widget-footer-timer">{paused ? `${elapsed} · Paused` : elapsed}</span>
        <div className="widget-footer-controls">
          <AudioSessionWaveform active={showWave} size="md" />
          {activity !== 'silent' ? <span className="widget-footer-mic">{activity}</span> : null}
          {recording ? (
            paused ? (
              <button type="button" className="widget-btn widget-btn-secondary" aria-label="Resume" onClick={onResume}>
                Resume
              </button>
            ) : (
              <button type="button" className="widget-btn widget-btn-ghost" aria-label="Pause" onClick={onPause}>
                Pause
              </button>
            )
          ) : null}
          <button type="button" className="widget-btn widget-btn-danger" aria-label="Stop" onClick={onStop}>
            <span className="widget-stop-icon" />
            Stop
          </button>
        </div>
      </div>
    </div>
  )
}
