'use client'

import { LandingSectionHeader } from '@/components/marketing'

import { GmailDictationMock } from './GmailDictationMock'
import { LiveNotesMock } from './LiveNotesMock'

export function HowItWorksSection() {
  return (
    <section className="landing-section landing-section-tint" id="how-it-works" data-reveal>
      <LandingSectionHeader title="Clarifi on your screen" />
      <div className="landing-two-col">
        <div className="landing-feature-card light">
          <p className="landing-card-title dark">
            Hold Fn. Speak. Clarifi <span className="landing-pill-muted">dictates</span> where you&apos;re typing.
          </p>
          <p className="landing-card-sub dark">
            Hold <strong>Fn (Globe)</strong> or tap the bottom pill — ramble naturally and Clarifi strips
            filler, polishes your words, and drops text right at your cursor. Works in Gmail, Slack,
            Cursor, and anywhere you type.
          </p>
          <div className="landing-card-overlay landing-card-visual">
            <GmailDictationMock />
          </div>
        </div>

        <div className="landing-feature-card blue">
          <p className="landing-card-title">
            Jot a few words. Clarifi <span className="landing-pill-white">fills in</span> the rest.
          </p>
          <p className="landing-card-sub">
            Type light notes while you talk — Clarifi combines them with the live transcript into a
            full summary, decisions, and action items the moment the call ends.
          </p>
          <div className="landing-card-overlay landing-card-visual">
            <LiveNotesMock />
          </div>
        </div>
      </div>
    </section>
  )
}
