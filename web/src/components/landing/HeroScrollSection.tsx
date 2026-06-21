'use client'

import { AnimatedHero } from '@/components/ui/animated-hero'
import { HeroBackgroundPaths } from '@/components/ui/background-paths'
import { Logos3 } from '@/components/ui/logos3'
import { StackedCards } from '@/components/StackedCards'
import { HeroSalesDemo } from '@/components/landing/HeroSalesDemo'
import { HowItWorksSection } from '@/components/landing/HowItWorksSection'
import { MeetingNotesSection } from '@/components/landing/MeetingNotesSection'
import { DownloadWithInstallModal } from '@/components/DownloadWithInstallModal'
import { MarketingNav } from '@/components/marketing/MarketingNav'

const HERO_ROTATING_WORDS = [
  'meeting',
  'call',
  'interview',
  'presentation',
  'lecture',
  'webinar',
  'consultation',
  'project',
  'task',
] as const

export function HeroScrollSection() {
  return (
    <>
      <section className="landing-hero landing-hero-scroll" aria-label="Product demo">
        <HeroBackgroundPaths />

        <MarketingNav variant="hero" />

        <AnimatedHero
          className="landing-hero-copy"
          title="Your #1 AI Overlay"
          accentPrefix="For Every"
          words={[...HERO_ROTATING_WORDS]}
          description="Clarifi: real-time guidance through every meeting and task — invisible to everyone but you."
          actions={
            <DownloadWithInstallModal variant="compact" className="download-mac-btn-large" />
          }
        />

        <div className="landing-hero-demo-wrap" id="demo">
          <HeroSalesDemo />
        </div>

        <Logos3 />
      </section>

      <StackedCards />

      <MeetingNotesSection />

      <HowItWorksSection />
    </>
  )
}
