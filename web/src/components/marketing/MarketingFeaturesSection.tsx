'use client'

import { MeetingParticipantsMock } from '@/components/landing/MeetingParticipantsMock'
import { Gallery6, type GalleryItem } from '@/components/ui/gallery6'
import { LiveNotesMock } from '@/components/landing/LiveNotesMock'
import { RecordingWidgetMock } from '@/components/landing/RecordingWidgetMock'

import { ModelExploreDemo } from './ModelExploreDemo'
import './marketing-page-sections.css'

export function MarketingFeaturesSection() {
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
      visual: <RecordingWidgetMock />,
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
