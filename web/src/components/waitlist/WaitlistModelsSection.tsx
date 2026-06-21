'use client'

import { useRef, type RefObject } from 'react'

import { OverlayDemo, type OverlayDemoHandle } from '@/components/landing/OverlayDemo'
import { ScreenShareCompare } from '@/components/landing/ScreenShareCompare'
import { MeetingParticipantsMock } from '@/components/landing/MeetingParticipantsMock'
import { Gallery6, type GalleryItem } from '@/components/ui/gallery6'

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

  const items: GalleryItem[] = [
    {
      id: 'no-bots',
      title: "Doesn't join meetings.",
      summary: 'No bots. No extra people on the guest list.',
      visualClassName: 'gallery6-visual-participants',
      visual: <MeetingParticipantsMock />,
    },
    {
      id: 'screen-share',
      title: 'Invisible to screen share.',
      summary: 'Never shows up in shared screens, recordings, or external tools.',
      visualClassName: 'gallery6-visual-compare',
      visual: <ScreenShareCompare />,
    },
    {
      id: 'drag-drop',
      title: 'Drag and drop.',
      summary: 'Move Clarifi anywhere on your screen — always within reach.',
      visualClassName: 'gallery6-visual-move',
      visual: <MoveOverlayDemo demoRef={moveDemoRef} />,
    },
    {
      id: 'models',
      title: 'Models',
      summary:
        'Scroll and expand providers to preview Anthropic, OpenAI, and Gemini — the same lineup in the desktop app.',
      visualClassName: 'gallery6-visual-models',
      visual: <ModelExploreDemo />,
    },
  ]

  return <Gallery6 items={items} />
}
