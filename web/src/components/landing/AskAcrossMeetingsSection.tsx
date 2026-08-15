'use client'

import './ask-across-meetings.css'

const SUGGESTIONS = [
  'What are the key takeaways from the Acme pilot kickoff?',
  "Who owns the security one-pager from last week's calls?",
  "What's still blocking procurement across recent sales meetings?",
  'What have engineers been focusing on this month?',
  'What decisions were made in the last three syncs?',
  'What follow-ups am I still missing from Friday?',
] as const

/**
 * Cross-meeting Ask marketing stage (Jamie-style composition).
 * Clarifi product chrome and copy — brand blue, Ask Clarifi.
 */
export function AskAcrossMeetingsSection() {
  return (
    <section
      className="aam-section"
      id="ask-meetings"
      data-reveal
      aria-label="Ask Clarifi about your meetings"
    >
      <header className="aam-intro">
        <span className="aam-mark" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2.5l1.6 5.2L19 9.3l-5.4 1.6L12 16.5l-1.6-5.6L5 9.3l5.4-1.6L12 2.5z"
              fill="currentColor"
            />
            <path
              d="M19.5 14.5l.7 2.2 2.3.7-2.3.7-.7 2.2-.7-2.2-2.3-.7 2.3-.7.7-2.2z"
              fill="currentColor"
              opacity="0.85"
            />
          </svg>
        </span>
        <h2 className="aam-title">Ask anything about your meetings</h2>
        <p className="aam-sub">
          Pull the detail a client mentioned weeks ago, or spot patterns across dozens of calls.
          Clarifi answers from your notes and summaries—with the meeting memory you need.
        </p>
      </header>

      <div className="aam-stage">
        <div className="aam-card" aria-hidden>
          <div className="aam-card-fade" />
          <ul className="aam-suggestions">
            {SUGGESTIONS.map((q) => (
              <li key={q} className="aam-suggestion">
                <span className="aam-suggestion-icon" />
                <span>{q}</span>
              </li>
            ))}
          </ul>

          <div className="aam-composer">
            <span className="aam-composer-plus">+</span>
            <span className="aam-composer-divider" />
            <span className="aam-composer-placeholder">Ask Clarifi</span>
            <span className="aam-composer-mic" />
            <span className="aam-composer-send" />
          </div>
        </div>
      </div>
    </section>
  )
}
