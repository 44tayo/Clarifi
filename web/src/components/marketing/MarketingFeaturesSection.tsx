'use client'

import { useRef, type RefObject } from 'react'

import { OverlayDemo, type OverlayDemoHandle } from '@/components/landing/OverlayDemo'
import { MeetingParticipantsMock } from '@/components/landing/MeetingParticipantsMock'
import { Gallery6, type GalleryItem } from '@/components/ui/gallery6'
import { LiveNotesMock } from '@/components/landing/LiveNotesMock'

import { ModelExploreDemo } from './ModelExploreDemo'
import './marketing-page-sections.css'

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

export function MarketingFeaturesSection() {
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
      id: 'live-notes',
      title: 'Take light notes, get polished ones.',
      summary: 'Jot a few words during the call — Clarifi fills in the rest with a full summary after.',
      visualClassName: 'gallery6-visual-compare',
      visual: <LiveNotesMock />,
    },
    {
      id: 'drag-drop',
      title: 'Floating widget while you meet.',
      summary: 'A compact always-on-top pill shows the timer and stop — click to jump back to your notepad.',
      visualClassName: 'gallery6-visual-move',
      visual: <MoveOverlayDemo demoRef={moveDemoRef} />,
    },
    {
      id: 'models',
      title: 'Your notes, your languages.',
      summary:
        'Clarifi supports the languages you meet in — set preferences once and get summaries that match how you work.',
      visualClassName: 'gallery6-visual-models',
      visual: <ModelExploreDemo />,
    },
  ]

  return <Gallery6 items={items} />
}
