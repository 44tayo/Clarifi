'use client'

import { useState, type CSSProperties } from 'react'

import './overlap-product-stage.css'

type OverlapProductStageProps = {
  frontMedia?: string
  backMedia?: string
}

type FrontMode = 'transcript' | 'notepad'

type SpeakerTone = 'you' | 'maya'

type ScriptLine = {
  speaker: string
  initial: string
  tone: SpeakerTone
  text: string
  delayMs: number
  durationMs: number
}

const MEETING_TITLE = 'Pilot Kickoff'

const CHAR_MS = 34
const GAP_MS = 550
const START_MS = 350

const RAW_LINES: Omit<ScriptLine, 'delayMs' | 'durationMs'>[] = [
  {
    speaker: 'Maya Chen',
    initial: 'M',
    tone: 'maya',
    text: "We'd love a two-week pilot before full rollout.",
  },
  {
    speaker: 'You',
    initial: 'T',
    tone: 'you',
    text: "Works — we'll need a security one-pager first.",
  },
  {
    speaker: 'Maya Chen',
    initial: 'M',
    tone: 'maya',
    text: 'I can send that over by EOD tomorrow.',
  },
  {
    speaker: 'You',
    initial: 'T',
    tone: 'you',
    text: "Perfect. Let's lock Friday at 2pm PT.",
  },
]

function buildScript(lines: typeof RAW_LINES): ScriptLine[] {
  let cursor = START_MS
  return lines.map((line) => {
    const durationMs = Math.max(line.text.length * CHAR_MS, 900)
    const timed = { ...line, delayMs: cursor, durationMs }
    cursor += durationMs + GAP_MS
    return timed
  })
}

const TRANSCRIPT_SCRIPT = buildScript(RAW_LINES)

const NOTEPAD_SCRIPT =
  "remember to send security one-pager\n\ndon't forget Fri 2pm with Maya"

/**
 * Linear-style overlap: tall Clarifi meeting surface over a wide recap board.
 * Front panel: CSS-driven two-person live transcript (no JS timers).
 */
export function OverlapProductStage({ frontMedia, backMedia }: OverlapProductStageProps) {
  return (
    <section className="ops-section" aria-label="Clarifi product preview">
      <header className="ops-intro">
        <h2 className="ops-intro-title">From light notes to meetings you can act on</h2>
        <div className="ops-intro-copy">
          <p>
            Jot a line or two while you talk. Clarifi captures the conversation beside you, then
            hands you a clear summary, decisions, and next steps the moment you stop.
          </p>
          <span className="ops-intro-link">See how it works →</span>
        </div>
      </header>

      <div className="ops-stage">
        <div
          className="ops-panel ops-panel--back"
          style={backMedia ? { backgroundImage: `url(${backMedia})` } : undefined}
          data-has-media={backMedia ? '' : undefined}
        >
          {!backMedia ? <RecapBoardMock /> : <span className="ops-media-label">Recap board</span>}
        </div>

        <div
          className="ops-panel ops-panel--front"
          style={frontMedia ? { backgroundImage: `url(${frontMedia})` } : undefined}
          data-has-media={frontMedia ? '' : undefined}
        >
          {!frontMedia ? <MeetingFrontMock /> : <span className="ops-media-label">Clarifi notepad</span>}
        </div>
      </div>
    </section>
  )
}

function NotepadGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2.5" y="2" width="11" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.2 5.5h5.6M5.2 8h5.6M5.2 10.5h3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function TranscriptGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 4.5c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v5.2c0 1.1-.9 2-2 2H7.8L5 14v-2.3H5c-1.1 0-2-.9-2-2V4.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M5.5 5.8h5M5.5 8h3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function MeetingFrontMock() {
  const [mode, setMode] = useState<FrontMode>('transcript')
  const [txKey, setTxKey] = useState(0)
  const [notesKey, setNotesKey] = useState(0)

  const setModeAndReset = (next: FrontMode) => {
    if (next === mode) return
    setMode(next)
    if (next === 'transcript') setTxKey((k) => k + 1)
    else setNotesKey((k) => k + 1)
  }

  const toggleMode = () => setModeAndReset(mode === 'transcript' ? 'notepad' : 'transcript')

  return (
    <div className="ops-front-mock ops-front-mock--widget">
      <header className="ops-widget-chrome">
        <div className="ops-traffic" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <span className="ops-widget-title">{MEETING_TITLE}</span>
        <div className="ops-widget-actions">
          <button
            type="button"
            className={mode === 'notepad' ? 'ops-icon-btn is-active' : 'ops-icon-btn'}
            aria-label="Show scratchpad"
            aria-pressed={mode === 'notepad'}
            onClick={(e) => {
              e.stopPropagation()
              setModeAndReset('notepad')
            }}
          >
            <NotepadGlyph />
          </button>
          <button
            type="button"
            className={mode === 'transcript' ? 'ops-icon-btn is-active' : 'ops-icon-btn'}
            aria-label="Show live transcript"
            aria-pressed={mode === 'transcript'}
            onClick={(e) => {
              e.stopPropagation()
              setModeAndReset('transcript')
            }}
          >
            <TranscriptGlyph />
          </button>
        </div>
      </header>

      <div
        className="ops-widget-body"
        role="button"
        tabIndex={0}
        aria-label={
          mode === 'transcript'
            ? 'Live transcript. Click to open scratchpad.'
            : 'Scratchpad. Click to open live transcript.'
        }
        onClick={toggleMode}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            toggleMode()
          }
        }}
      >
        <h3 className="ops-widget-heading">{MEETING_TITLE}</h3>

        {mode === 'transcript' ? (
          <div className="ops-thread ops-thread--live" key={txKey}>
            {TRANSCRIPT_SCRIPT.map((line) => (
              <article
                key={`${line.speaker}-${line.delayMs}`}
                className="ops-msg ops-msg--typed"
                style={
                  {
                    '--ops-msg-delay': `${line.delayMs}ms`,
                    '--ops-msg-dur': `${line.durationMs}ms`,
                  } as CSSProperties
                }
              >
                <span className={`ops-avatar ops-avatar--${line.tone}`}>{line.initial}</span>
                <div className="ops-msg-body">
                  <div className="ops-msg-meta">
                    <strong>{line.speaker}</strong>
                    <span className="ops-msg-source">{line.tone === 'you' ? 'You' : 'Meeting'}</span>
                    <span className="ops-live-badge ops-live-badge--timed">live</span>
                  </div>
                  <p className="ops-type-wrap">
                    {line.text.split('').map((ch, index) => (
                      <span
                        key={`${line.delayMs}-${index}`}
                        className="ops-type-ch"
                        style={
                          {
                            animationDelay: `${line.delayMs + index * CHAR_MS}ms`,
                          } as CSSProperties
                        }
                      >
                        {ch}
                      </span>
                    ))}
                    <span
                      className="ops-caret ops-type-line-caret"
                      style={
                        {
                          '--ops-msg-delay': `${line.delayMs}ms`,
                          '--ops-msg-dur': `${line.durationMs}ms`,
                        } as CSSProperties
                      }
                      aria-hidden
                    />
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="ops-thread ops-thread--notes" key={notesKey}>
            <p className="ops-notes-body ops-notes-body--typed">
              {NOTEPAD_SCRIPT.split('').map((ch, index) => (
                <span
                  key={`${notesKey}-${index}`}
                  className="ops-type-ch"
                  style={{ animationDelay: `${200 + index * 36}ms` } as CSSProperties}
                >
                  {ch}
                </span>
              ))}
              <span className="ops-caret ops-caret--purple ops-type-ch-caret" aria-hidden />
            </p>
          </div>
        )}
      </div>

      <div className="ops-widget-footer" aria-hidden>
        <span className="ops-footer-timer">00:28</span>
        <div className="ops-footer-wave is-active">
          <span />
          <span />
          <span />
          <span />
        </div>
        <span className="ops-footer-mic" />
        <span className="ops-footer-stop">
          <i />
          Stop
        </span>
      </div>
    </div>
  )
}

function RecapBoardMock() {
  return (
    <div className="ops-back-mock" aria-hidden>
      <header className="ops-back-header">
        <div>
          <p className="ops-back-kicker">Meeting ready</p>
          <h3 className="ops-back-title">Acme Corp — Pilot Kickoff</h3>
        </div>
        <span className="ops-back-date">Fri, Mar 14</span>
      </header>

      <p className="ops-back-summary">
        Agreed on a 2-week pilot starting next Monday. Procurement needs a security one-pager before
        sign-off.
      </p>

      <div className="ops-columns">
        <div className="ops-col">
          <div className="ops-col-head">
            <span>Decisions</span>
            <span className="ops-col-count">2</span>
          </div>
          <div className="ops-card">
            <span className="ops-tag ops-tag--blue">Scope</span>
            <p>Pilot runs two weeks before full rollout</p>
          </div>
          <div className="ops-card">
            <span className="ops-tag ops-tag--green">Owner</span>
            <p>Clarifi sends updated timeline by EOD</p>
          </div>
        </div>

        <div className="ops-col">
          <div className="ops-col-head">
            <span>Action items</span>
            <span className="ops-col-count">3</span>
          </div>
          <div className="ops-card">
            <span className="ops-tag ops-tag--red">Urgent</span>
            <p>Send security one-pager to procurement</p>
          </div>
          <div className="ops-card">
            <span className="ops-tag ops-tag--blue">Follow-up</span>
            <p>Confirm pilot start date with Alex</p>
          </div>
          <div className="ops-card">
            <span className="ops-tag ops-tag--muted">Schedule</span>
            <p>Decision call Friday 2pm PT</p>
          </div>
        </div>

        <div className="ops-col ops-col--faded">
          <div className="ops-col-head">
            <span>Notes</span>
            <span className="ops-col-count">4</span>
          </div>
          <div className="ops-card">
            <p>Security review before procurement sign-off</p>
          </div>
          <div className="ops-card">
            <p>Seat expansion after pilot feedback</p>
          </div>
        </div>
      </div>
    </div>
  )
}
