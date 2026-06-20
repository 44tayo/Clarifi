'use client'

import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect } from 'react'

import { FaqSection } from '@/components/landing/FaqSection'
import { HeroScrollSection } from '@/components/landing/HeroScrollSection'
import { FeaturedSectionStats } from '@/components/ui/featured-section-stats'
import { WaitlistModelsSection } from '@/components/waitlist/WaitlistModelsSection'
import { WaitlistProductSections, WaitlistSiteFooter } from '@/components/waitlist/WaitlistPageSections'

import '@/components/landing/landing.css'
import '@/components/waitlist/waitlist.css'
import '@/components/waitlist/waitlist-page-sections.css'

export function MarketingHomePage() {
  const searchParams = useSearchParams()

  const scrollToFaq = useCallback(() => {
    document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const error = searchParams.get('error')
    if (
      searchParams.get('checkout') === 'success' ||
      searchParams.get('joined') === '1' ||
      error === 'auth' ||
      error === 'config' ||
      error === 'waitlist'
    ) {
      scrollToFaq()
    }
  }, [searchParams, scrollToFaq])

  return (
    <div className="landing-root waitlist-page">
      <HeroScrollSection />
      <WaitlistModelsSection />
      <FeaturedSectionStats />
      <WaitlistProductSections />
      <FaqSection className="waitlist-faq" />
      <WaitlistSiteFooter />
    </div>
  )
}
