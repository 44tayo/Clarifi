'use client'

import { AnimatedHero } from '@/components/ui/animated-hero'
import { HeroBackgroundPaths } from '@/components/ui/background-paths'
import { Logos3 } from '@/components/ui/logos3'
import { SectionWithMockup } from '@/components/ui/section-with-mockup'
import { HeroSalesDemo } from '@/components/landing/HeroSalesDemo'
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

      <SectionWithMockup
        title={
          <>
            Intelligence,
            <br />
            delivered to you.
          </>
        }
        description={
          <>
            Get a tailored Monday morning brief directly in
            <br />
            your inbox, crafted by your virtual personal
            <br />
            analyst, spotlighting essential watchlist stories
            <br />
            and earnings for the week ahead.
          </>
        }
        primaryImageSrc="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80"
      />

      <MeetingNotesSection />
    </>
  )
}
