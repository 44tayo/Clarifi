'use client'

import { useRef, type RefObject } from 'react'
import { OverlayDemo, type OverlayDemoHandle } from '@/components/landing/OverlayDemo'
import { ScreenShareCompare } from '@/components/landing/ScreenShareCompare'
import { MeetingParticipantsMock } from '@/components/landing/MeetingParticipantsMock'
import { ModelExploreDemo } from './ModelExploreDemo'
import './waitlist-page-sections.css'

function MoveOverlayDemo({ demoRef }: { demoRef: RefObject<OverlayDemoHandle | null> }) {
  const nudge = (dx: number, dy: number) => demoRef.current?.nudge(dx, dy)

  return (
    <>
      <div className="landing-move-widget">
        <OverlayDemo size="sm" draggable showMoveArrows demoRef={demoRef} />
      </div>
      <div className="landing-keys-row">
        <span className="landing-key-mini">⌘</span>
        <span>+</span>
        {(
          [
            { label: '↑', dx: 0, dy: -14 },
            { label: '↓', dx: 0, dy: 14 },
            { label: '←', dx: -14, dy: 0 },
            { label: '→', dx: 14, dy: 0 },
          ] as const
        ).map((key) => (
          <button
            key={key.label}
            type="button"
            className="landing-key-mini landing-key-btn"
            onClick={() => nudge(key.dx, key.dy)}
            aria-label={`Move overlay ${key.label}`}
          >
            {key.label}
          </button>
        ))}
      </div>
    </>
  )
}

export function WaitlistModelsSection() {
  const moveDemoRef = useRef<OverlayDemoHandle>(null)

  return (
    <section
      id="features"
      className="landing-section landing-section-tint waitlist-features-section"
      data-reveal
    >
      <div className="landing-section-header centered" data-reveal>
        <h2>View some of our features</h2>
        <p>Our collection of Clarifi features for your convenience</p>
      </div>
      <div className="landing-undetect-grid" data-reveal-group>
        <div className="landing-undetect-feature grad-purple" data-reveal>
          <div className="landing-undetect-visual landing-undetect-visual-participants">
            <MeetingParticipantsMock />
          </div>
          <h3>Doesn&apos;t join meetings.</h3>
          <p>No bots. No extra people on the guest list.</p>
        </div>

        <div className="landing-undetect-feature grad-pink" data-reveal>
          <div className="landing-undetect-visual landing-undetect-visual-compare">
            <ScreenShareCompare />
          </div>
          <h3>Invisible to screen share.</h3>
          <p>Never shows up in shared screens, recordings, or external tools.</p>
        </div>

        <div className="landing-undetect-feature grad-blue" data-reveal>
          <div className="landing-undetect-visual landing-undetect-move">
            <MoveOverlayDemo demoRef={moveDemoRef} />
          </div>
          <h3>Drag and drop.</h3>
          <p>Move Clarifi anywhere on your screen — always within reach.</p>
        </div>

        <div className="landing-undetect-feature grad-teal" data-reveal>
          <div className="landing-undetect-visual landing-undetect-visual-models">
            <ModelExploreDemo />
          </div>
          <h3>Explore our models.</h3>
          <p>
            Scroll and expand providers to preview Anthropic, OpenAI, and Gemini — the same
            lineup in the desktop app.
          </p>
        </div>
      </div>
    </section>
  )
}
