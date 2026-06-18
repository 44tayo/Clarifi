'use client'

import type { ReactNode } from 'react'

import type { MarketingFeatureVariant } from '@/lib/design-tokens'
import { featureAccentColors } from '@/lib/design-tokens'
import {
  LandingSection,
  LandingSectionHeader,
  MarketingFeatureCard,
  MarketingFeatureGrid,
  MarketingFeatureMock,
} from '@/components/marketing'

function NotetakerVisual() {
  return (
    <MarketingFeatureMock layout="summary">
      <div className="ds-mock-doc">
        <p className="ds-mock-doc-title">Summary</p>
        <p className="ds-mock-doc-label">Key Discussion Points</p>
        <ul>
          <li>Clarified rollout timeline and pilot scope for the team.</li>
          <li>Agreed on seat-by-seat expansion after a two-week pilot.</li>
          <li>Next step: send recap with action items and pricing.</li>
        </ul>
      </div>
    </MarketingFeatureMock>
  )
}

function ChatOverlayVisual() {
  return (
    <MarketingFeatureMock layout="chat">
      <div className="ds-mock-chat-window">
        <div className="ds-mock-chat-input">Ask anything...</div>
        <div className="ds-mock-chat-bubble">
          <span className="ds-mock-chat-brand">Clarifi</span>
          <p>Here&apos;s a concise answer based on your screen and transcript.</p>
        </div>
        <div className="ds-mock-chat-prompt">what should I say about the pilot timeline?</div>
      </div>
    </MarketingFeatureMock>
  )
}

function DictationVisual() {
  return (
    <MarketingFeatureMock>
      <svg viewBox="0 0 200 200" className="ds-mock-globe" aria-hidden>
        <circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <ellipse cx="100" cy="100" rx="72" ry="28" fill="none" stroke="currentColor" strokeWidth="1" />
        <ellipse cx="100" cy="100" rx="28" ry="72" fill="none" stroke="currentColor" strokeWidth="1" />
        <path d="M28 100 H172 M100 28 V172" fill="none" stroke="currentColor" strokeWidth="0.8" />
      </svg>
    </MarketingFeatureMock>
  )
}

function NotesVisual() {
  const notes = [
    { label: 'Weekly Team Sync', color: featureAccentColors.green },
    { label: 'Q4 Product Strategy', color: featureAccentColors.purple },
    { label: 'Customer Discovery', color: featureAccentColors.sky },
    { label: 'Sales Kickoff', color: featureAccentColors.orange },
    { label: 'Board Update', color: featureAccentColors.cyan },
  ]

  return (
    <MarketingFeatureMock layout="notes">
      {notes.map((note) => (
        <div key={note.label} className="ds-mock-note-chip" style={{ backgroundColor: note.color }}>
          <span />
          <p>{note.label}</p>
        </div>
      ))}
    </MarketingFeatureMock>
  )
}

function ShareVisual() {
  return (
    <MarketingFeatureMock layout="share">
      <div className="ds-mock-share-head" aria-hidden />
      <div className="ds-mock-share-bubble ds-mock-share-bubble-violet">Kate</div>
      <div className="ds-mock-share-bubble ds-mock-share-bubble-blue">Jake</div>
    </MarketingFeatureMock>
  )
}

const FEATURES: {
  variant: MarketingFeatureVariant
  title: string
  description: string
  visual: ReactNode
}[] = [
  {
    variant: 'wide',
    title: 'AI meeting notetaker',
    description:
      "Capture every word so you don't miss anything. Focus on your meeting and let Clarifi take detailed notes for you instantly.",
    visual: <NotetakerVisual />,
  },
  {
    variant: 'narrow',
    title: 'Seamless chat overlay',
    description:
      'A transparent chat window that floats above your screen. Work with AI while keeping your apps visible.',
    visual: <ChatOverlayVisual />,
  },
  {
    variant: 'third',
    title: 'Universal dictation',
    description: 'Turn your voice into perfectly formatted text 3x faster than typing.',
    visual: <DictationVisual />,
  },
  {
    variant: 'third',
    title: 'Chat with your notes',
    description:
      'Your second brain. Instantly query details from past meetings or documents just by asking. (coming soon)',
    visual: <NotesVisual />,
  },
  {
    variant: 'third',
    title: 'Share meeting notes',
    description:
      'Keep everyone in the loop. Send summaries and next steps to everyone in the call. (coming soon)',
    visual: <ShareVisual />,
  },
]

export function ClarifiBentoSection() {
  return (
    <LandingSection className="clarifi-bento-section">
      <LandingSectionHeader
        title="Everything you need for all your conversations"
        subtitle="Record on your Laptop - get live support, instant recaps and connect your apps to take action"
      />

      <MarketingFeatureGrid>
        {FEATURES.map((feature) => (
          <MarketingFeatureCard
            key={feature.title}
            variant={feature.variant}
            title={feature.title}
            description={feature.description}
            visual={feature.visual}
          />
        ))}
      </MarketingFeatureGrid>
    </LandingSection>
  )
}
