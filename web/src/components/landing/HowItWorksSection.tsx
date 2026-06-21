'use client'

import { LandingSectionHeader } from '@/components/marketing'

import { GmailDictationMock } from './GmailDictationMock'
import { ScreenShareAssistMock } from './ScreenShareAssistMock'

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
            Share your screen. Clarifi <span className="landing-pill-white">guides</span> you instantly.
          </p>
          <p className="landing-card-sub">
            Turn on screen context and Clarifi reads what&apos;s visible — then walks you through exactly
            what to say, click, or fix. Step by step, in the moment.
          </p>
          <div className="landing-card-overlay landing-card-visual">
            <ScreenShareAssistMock />
          </div>
        </div>
      </div>
    </section>
  )
}
