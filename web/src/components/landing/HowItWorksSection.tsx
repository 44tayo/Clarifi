'use client'

import { LandingSectionHeader } from '@/components/marketing'

import { LiveNotesMock } from './LiveNotesMock'
import { RecordingWidgetMock } from './RecordingWidgetMock'

export function HowItWorksSection() {
  return (
    <section className="landing-section landing-section-tint" id="how-it-works" data-reveal>
      <LandingSectionHeader title="Clarifi on your screen" />
      <div className="landing-two-col">
        <div className="landing-feature-card light">
          <p className="landing-card-title dark">
            Keep a <span className="landing-pill-muted">floating notepad</span> while you talk.
          </p>
          <p className="landing-card-sub dark">
            Clarifi sits on top of Zoom, Meet, or Teams as a quiet pill — timer, pause, and scratchpad —
            so you can jot a line without leaving the call.
          </p>
          <div className="landing-card-overlay landing-card-visual">
            <RecordingWidgetMock />
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
