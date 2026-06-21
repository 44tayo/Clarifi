'use client'

import { Mail, Search, Share2 } from 'lucide-react'

const RECAP_SUMMARY =
  'Agreed on a 2-week pilot starting next Monday. Procurement needs a security one-pager before sign-off.'

const DECISIONS = [
  'Pilot runs two weeks before full rollout',
  'Clarifi sends updated timeline and scope by EOD',
] as const

const ACTION_ITEMS = [
  'Confirm pilot start date with Alex',
  'Send security one-pager to procurement',
  'Schedule decision call for Friday at 2pm PT',
] as const

const NOTES_HIGHLIGHTS = [
  {
    title: 'No bot in the room',
    description:
      'Record from your desktop — your meeting stays completely normal. Clarifi never joins as a guest.',
  },
  {
    title: 'Recaps you can act on',
    description:
      'Stop recording and get a clear summary with decisions and action items, ready to copy or share.',
  },
  {
    title: 'Follow-up in one click',
    description:
      'Draft a follow-up email from the recap the moment the call ends — no retyping from scratch.',
  },
] as const

export function MeetingNotesSection() {
  return (
    <section className="landing-notes-showcase-section" data-reveal>
      <div className="landing-notes-showcase-inner">
        <div className="landing-notes-split">
          <div className="landing-notes-showcase-frame" data-reveal>
            <div className="landing-notes-showcase-window">
              <header className="landing-notes-showcase-chrome">
                <div className="landing-notes-showcase-dots" aria-hidden>
                  <span />
                  <span />
                  <span />
                </div>
                <div className="landing-notes-showcase-search">
                  <Search className="landing-notes-showcase-search-icon" aria-hidden />
                  <span>Search sessions</span>
                </div>
                <div className="landing-notes-showcase-chrome-actions">
                  <button type="button" className="landing-notes-showcase-start">
                    Start Clarifi
                  </button>
                  <span className="landing-notes-showcase-avatar" aria-hidden />
                </div>
              </header>

              <div className="landing-notes-showcase-body">
                <p className="landing-notes-meta">Friday, Mar 14</p>
                <p className="landing-notes-title">Acme Corp — Pilot Kickoff</p>

                <div className="landing-notes-showcase-toolbar">
                  <div className="landing-notes-tabs">
                    <span className="active">Summary</span>
                    <span>Transcript</span>
                    <span>Recap</span>
                  </div>
                  <div className="landing-notes-showcase-actions">
                    <button type="button" className="landing-notes-showcase-action-btn">
                      <Mail className="size-3.5" aria-hidden />
                      Follow-up email
                    </button>
                    <button type="button" className="landing-notes-showcase-action-btn">
                      <Share2 className="size-3.5" aria-hidden />
                      Share
                    </button>
                  </div>
                </div>

                <p className="landing-notes-recap-lead">{RECAP_SUMMARY}</p>

                <div className="landing-notes-showcase-summary-head">
                  <p className="landing-notes-heading">Decisions</p>
                </div>
                <ul className="landing-notes-showcase-list landing-notes-showcase-list-compact">
                  {DECISIONS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>

                <div className="landing-notes-showcase-summary-head">
                  <p className="landing-notes-heading">Action Items</p>
                  <button type="button" className="landing-notes-showcase-copy">
                    Copy full summary
                  </button>
                </div>

                <ul className="landing-notes-showcase-list">
                  {ACTION_ITEMS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <footer className="landing-notes-showcase-footer">
                <button type="button" className="landing-notes-showcase-resume">
                  View recap
                </button>
                <div className="landing-notes-ask">Ask Clarifi about this session…</div>
              </footer>
            </div>
          </div>

          <div className="landing-notes-copy" data-reveal>
            <h2>Instant recaps after every session</h2>
            <p className="landing-notes-copy-sub">
              Stop recording and Clarifi delivers a clear summary with decisions, action items, and a
              follow-up draft — without a bot ever joining the call.
            </p>
            <div className="landing-notes-feature-rows">
              {NOTES_HIGHLIGHTS.map((item) => (
                <div key={item.title} className="landing-notes-feature-row">
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
