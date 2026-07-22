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

const MEETING_APP_LOGOS = [
  { id: 'zoom', description: 'Zoom', image: '/logos/zoom.svg', className: 'h-9 w-auto' },
  { id: 'google-meet', description: 'Google Meet', image: '/logos/google-meet.svg', className: 'h-8 w-auto' },
  { id: 'microsoft-teams', description: 'Microsoft Teams', image: '/logos/microsoft-teams.svg', className: 'h-9 w-auto' },
  { id: 'slack', description: 'Slack', image: '/logos/slack.svg', className: 'h-8 w-auto' },
  { id: 'discord', description: 'Discord', image: '/logos/discord.svg', className: 'h-9 w-auto' },
]

export function HeroScrollSection() {
  return (
    <>
      <section className="landing-hero landing-hero-scroll" aria-label="Product demo">
        <HeroBackgroundPaths />

        <MarketingNav variant="hero" />

        <AnimatedHero
          className="landing-hero-copy"
          title="Your AI notepad"
          accentPrefix="For Every"
          words={[...HERO_ROTATING_WORDS]}
          description="Clarifi listens in the background while you take light notes, then turns every meeting into a clean summary, decisions, and action items — no bot ever joins the call."
          actions={
            <DownloadWithInstallModal variant="compact" className="download-mac-btn-large" />
          }
        />

        <div className="landing-hero-demo-wrap" id="demo">
          <div className="landing-hero-demo-seam" aria-hidden="true" />
          <HeroSalesDemo />
        </div>

        <Logos3 />
      </section>

      <StackedCards />

      <Logos3
        heading="Works with every meeting app"
        logos={MEETING_APP_LOGOS}
        grayscale={false}
        strip
        headingClassName="text-[12px] font-semibold uppercase tracking-[0.22em] text-[color:var(--ds-muted)]"
      />

      <MeetingNotesSection />

      <HowItWorksSection />
    </>
  )
}
