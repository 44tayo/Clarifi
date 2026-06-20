'use client'

import { Mail, Search, Share2 } from 'lucide-react'

import { LandingSectionHeader } from '@/components/marketing'

const ACTION_ITEMS = [
  'Choose final label for creator-face videos',
  'Pick the icon style for Programs',
  'Decide on the default landing page layout',
  'Align on the creator onboarding flow and timeline',
  'Review the updated Programs page design',
  'Confirm the default landing page layout',
] as const

const NOTES_HIGHLIGHTS = [
  {
    title: 'Access Anywhere',
    description: 'Overlay appears only when you need it and vanishes when you don\u2019t.',
  },
  {
    title: "Speak, Don't Type",
    description: 'Watch raw voice dictation turn into perfectly formatted text in real-time.',
  },
  {
    title: 'Instant Recall',
    description: 'Chat with your notes to quickly find past meeting details. (coming soon)',
  },
] as const

export function MeetingNotesSection() {
  return (
    <section className="landing-notes-showcase-section" data-reveal>
      <div className="landing-notes-showcase-inner">
        <LandingSectionHeader
          title="Instant meeting notes"
          subtitle="The easiest way to get beautiful, shareable meeting notes."
        />

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
                <span>Search</span>
              </div>
              <div className="landing-notes-showcase-chrome-actions">
                <button type="button" className="landing-notes-showcase-start">
                  Start Clarifi
                </button>
                <span className="landing-notes-showcase-avatar" aria-hidden />
              </div>
            </header>

            <div className="landing-notes-showcase-body">
              <p className="landing-notes-meta">Monday, Nov 3</p>
              <p className="landing-notes-title">Creator Platform Program Design Session</p>

              <div className="landing-notes-showcase-toolbar">
                <div className="landing-notes-tabs">
                  <span className="active">Summary</span>
                  <span>Transcript</span>
                  <span>Usage</span>
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
                Resume Session
              </button>
              <div className="landing-notes-ask">Ask Clarifi about this meeting…</div>
            </footer>
          </div>
        </div>

        <div className="landing-notes-highlights" data-reveal>
          {NOTES_HIGHLIGHTS.map((item) => (
            <div key={item.title} className="landing-notes-highlight">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
