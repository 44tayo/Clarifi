'use client'

import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect } from 'react'

import { FaqSection } from '@/components/landing/FaqSection'
import { HeroScrollSection } from '@/components/landing/HeroScrollSection'
import { FeaturedSectionStats } from '@/components/ui/featured-section-stats'
import { MarketingFeaturesSection } from '@/components/marketing/MarketingFeaturesSection'
import { MarketingSiteFooter } from '@/components/marketing/MarketingSiteFooter'

import '@/components/landing/landing.css'
import '@/components/marketing/marketing.css'
import '@/components/marketing/marketing-page-sections.css'

export function MarketingHomePage() {
  const searchParams = useSearchParams()

  const scrollToFaq = useCallback(() => {
    document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const error = searchParams.get('error')
    if (
      searchParams.get('checkout') === 'success' ||
      error === 'auth' ||
      error === 'config'
    ) {
      scrollToFaq()
    }
  }, [searchParams, scrollToFaq])

  return (
    <div className="landing-root marketing-page">
      <HeroScrollSection />
      <MarketingFeaturesSection />
      <FeaturedSectionStats />
      <FaqSection className="marketing-faq" />
      <MarketingSiteFooter />
    </div>
  )
}
