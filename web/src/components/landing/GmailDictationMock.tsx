'use client'

import { useEffect, useState } from 'react'

import './gmail-dictation-mock.css'

const SUBJECT = 'Pilot kickoff — Friday'
const BODY =
  "Hi Alex,\n\nFriday works on our end — I'll send over the updated timeline and pilot scope by EOD today.\n\nLet me know if 2pm PT still works for the kickoff call.\n\nThanks,\nTayo"

const INBOX_ROWS: Array<{
  from: string
  subject: string
  date: string
  unread?: boolean
}> = [
  { from: 'Procurement', subject: 'Security review checklist', date: '22 Jun', unread: true },
  { from: 'Alex Chen', subject: 'Re: Pilot kickoff', date: '15 Jun', unread: true },
  { from: 'Notion', subject: 'Your weekly digest', date: '8 Jun' },
  { from: 'Figma', subject: 'Comments on Q2 deck', date: '27 Apr' },
  { from: 'Stripe', subject: 'Your receipt', date: '24 Mar' },
]

type Phase =
  | 'idle'
  | 'recording'
  | 'processing'
  | 'typing-subject'
  | 'typing-body'
  | 'done'

/** Reveal text word-by-word while preserving whitespace/newlines for rendering. */
function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((token) => token.length > 0)
}

export function GmailDictationMock() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [subjectText, setSubjectText] = useState('')
  const [bodyText, setBodyText] = useState('')

  useEffect(() => {
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = setTimeout(resolve, ms)
        timers.push(t)
      })

    const typeText = async (
      full: string,
      setter: (value: string) => void,
      perWord: number,
    ) => {
      const tokens = tokenize(full)
      let assembled = ''
      for (let i = 0; i < tokens.length; i += 1) {
        if (cancelled) return
        assembled += tokens[i]
        // Only pause after real words, not the whitespace tokens.
        if (/\S/.test(tokens[i])) {
          setter(assembled)
          await wait(perWord + (i % 4 === 0 ? 70 : 0))
        }
      }
      setter(full)
    }

    const run = async () => {
      while (!cancelled) {
        setPhase('idle')
        setSubjectText('')
        setBodyText('')
        await wait(1000)

        setPhase('recording')
        await wait(2500)

        setPhase('processing')
        await wait(850)

        setPhase('typing-subject')
        await typeText(SUBJECT, setSubjectText, 115)
        await wait(320)

        setPhase('typing-body')
        await typeText(BODY, setBodyText, 90)

        setPhase('done')
        await wait(3200)
      }
    }

    run()

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [])

  const subjectCaret = phase === 'typing-subject'
  const bodyCaret = phase === 'typing-body' || phase === 'done'

  return (
    <div className="gdm-root" aria-hidden>
      <div className="gdm-screen" data-phase={phase}>
        <div className="gdm-topbar">
          <span className="gdm-icon-btn">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
              <path d="M3 6h18M3 12h18M3 18h18" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span className="gdm-logo">
            <svg className="gdm-logo-m" viewBox="0 0 256 193" width="22" height="17" aria-hidden>
              <path fill="#4285F4" d="M58.182 192.05V93.14L27.507 65.077 0 49.504v125.091c0 9.658 7.825 17.455 17.455 17.455z" />
              <path fill="#34A853" d="M197.818 192.05h40.727c9.659 0 17.455-7.826 17.455-17.455V49.504l-58.182 42.546z" />
              <path fill="#EA4335" d="M58.182 93.14l-4.174-38.647 4.174-36.989L128 70.057l69.818-52.553 4.669 34.992-4.669 40.644L128 145.504z" />
              <path fill="#FBBC04" d="M197.818 17.504V93.14L256 49.504V26.231c0-21.585-24.64-33.89-41.89-20.945z" />
              <path fill="#C5221F" d="M0 49.504l26.759 20.07L58.182 93.14V17.504L41.89 5.286C24.61-7.659 0 4.646 0 26.231z" />
            </svg>
            <span className="gdm-logo-word">Gmail</span>
          </span>
          <div className="gdm-search">
            <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden>
              <circle cx="11" cy="11" r="7" stroke="#5f6368" strokeWidth="2" fill="none" />
              <path d="M21 21l-4-4" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="gdm-search-text">Search mail</span>
            <svg className="gdm-search-tune" viewBox="0 0 24 24" width="13" height="13" aria-hidden>
              <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" />
              <circle cx="16" cy="6" r="2" fill="#5f6368" />
              <circle cx="8" cy="12" r="2" fill="#5f6368" />
              <circle cx="13" cy="18" r="2" fill="#5f6368" />
            </svg>
          </div>
          <div className="gdm-top-icons">
            <span className="gdm-top-glyph">?</span>
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
              <circle cx="12" cy="12" r="3" stroke="#5f6368" strokeWidth="2" fill="none" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="#5f6368" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="gdm-apps-grid">
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} />
              ))}
            </span>
            <span className="gdm-avatar">T</span>
          </div>
        </div>

        <div className="gdm-body">
          <div className="gdm-sidebar">
            <div className="gdm-compose-btn">
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
                <path d="M4 20h4l10-10-4-4L4 16v4z" fill="none" stroke="#444746" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
              <span>Compose</span>
            </div>
            <ul className="gdm-nav">
              <li className="active">
                <span>Inbox</span>
                <span className="gdm-nav-count">12</span>
              </li>
              <li>Starred</li>
              <li>Snoozed</li>
              <li>Sent</li>
              <li>Purchases</li>
              <li className="gdm-nav-more">More <span className="gdm-chevron" /></li>
            </ul>
            <div className="gdm-labels-head">Labels</div>
            <div className="gdm-label">
              <span className="gdm-label-dot" />
              Instagram
            </div>
          </div>

          <div className="gdm-inbox">
            {INBOX_ROWS.map((row) => (
              <div key={row.subject} className={`gdm-mail-row${row.unread ? ' unread' : ''}`}>
                <span className="gdm-mail-from">{row.from}</span>
                <span className="gdm-mail-subject">{row.subject}</span>
                <span className="gdm-mail-date">{row.date}</span>
              </div>
            ))}
          </div>

          <div className="gdm-rail">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className="gdm-rail-icon" />
            ))}
            <span className="gdm-rail-plus">+</span>
          </div>
        </div>

        <div className="gdm-popup">
          <div className="gdm-popup-head">
            <span>New Message</span>
            <span className="gdm-popup-head-icons">
              <span className="gdm-win-dot">—</span>
              <span className="gdm-win-dot">⤢</span>
              <span className="gdm-win-dot">✕</span>
            </span>
          </div>
          <div className="gdm-popup-body">
            <div className="gdm-popup-row">
              <span className="gdm-popup-label">To</span>
              <span className="gdm-recipient">Alex Chen</span>
              <span className="gdm-ccbcc">Cc Bcc</span>
            </div>
            <div className="gdm-popup-row gdm-subject-row">
              {subjectText ? (
                <span className="gdm-subject-text">{subjectText}</span>
              ) : (
                !subjectCaret && <span className="gdm-placeholder">Subject</span>
              )}
              {subjectCaret && <span className="gdm-caret" />}
            </div>
            <div className="gdm-popup-text">
              {bodyText}
              {bodyCaret && <span className="gdm-caret" />}
            </div>
          </div>

          <div className="gdm-popup-toolbar">
            <div className="gdm-format-row">
              <span className="gdm-fmt-glyph">↶</span>
              <span className="gdm-fmt-glyph">↷</span>
              <span className="gdm-fmt-font">Sans Serif</span>
              <span className="gdm-fmt-caret" />
              <span className="gdm-fmt-sep" />
              <span className="gdm-fmt-glyph gdm-bold">B</span>
              <span className="gdm-fmt-glyph gdm-italic">I</span>
              <span className="gdm-fmt-glyph gdm-underline">U</span>
              <span className="gdm-fmt-sep" />
              <span className="gdm-fmt-square" />
              <span className="gdm-fmt-square" />
              <span className="gdm-fmt-square" />
            </div>
            <div className="gdm-send-row">
              <span className="gdm-send">
                Send
                <span className="gdm-send-caret" />
              </span>
              <div className="gdm-send-icons">
                <span className="gdm-send-aa">A</span>
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                  <path d="M21 12l-8.5 8.5a4 4 0 01-6-6L14 6a2.5 2.5 0 014 4l-8 8a1 1 0 01-1.5-1.5L16 9" fill="none" stroke="#5f6368" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                  <path d="M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66L11 7" fill="none" stroke="#5f6368" strokeWidth="1.6" strokeLinecap="round" />
                  <path d="M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66L13 17" fill="none" stroke="#5f6368" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                  <circle cx="12" cy="12" r="9" fill="none" stroke="#5f6368" strokeWidth="1.6" />
                  <circle cx="9" cy="10" r="1" fill="#5f6368" />
                  <circle cx="15" cy="10" r="1" fill="#5f6368" />
                  <path d="M8.5 14.5a4 4 0 007 0" fill="none" stroke="#5f6368" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                  <rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="#5f6368" strokeWidth="1.6" />
                  <circle cx="9" cy="10" r="1.4" fill="#5f6368" />
                  <path d="M5 17l4-4 3 3 3-3 4 4" fill="none" stroke="#5f6368" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
                <span className="gdm-send-more">⋮</span>
              </div>
              <svg className="gdm-trash" viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                <path d="M5 7h14M10 7V5h4v2M6 7l1 13h10l1-13" fill="none" stroke="#5f6368" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        <div className="gdm-pill-stage">
          <div className="gdm-fn-badge">Hold Fn (Globe)</div>
          <div className="gdm-pill gdm-pill-idle" />
          <div className="gdm-pill gdm-pill-recording">
            <span className="gdm-pill-btn">×</span>
            <div className="gdm-pill-wave">
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} />
              ))}
            </div>
            <span className="gdm-pill-btn gdm-pill-check">✓</span>
          </div>
          <div className="gdm-pill gdm-pill-processing">
            <span className="gdm-pill-spinner" />
          </div>
        </div>
      </div>
    </div>
  )
}
