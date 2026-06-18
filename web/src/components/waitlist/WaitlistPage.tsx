'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { ClarifiBentoSection } from '@/components/landing/ClarifiBentoSection'
import { FaqSection } from '@/components/landing/FaqSection'
import { HeroScrollSection } from '@/components/landing/HeroScrollSection'
import { FeaturedSectionStats } from '@/components/ui/featured-section-stats'
import { useLaunchCountdown } from '@/hooks/useLaunchCountdown'
import { createClient } from '@/lib/supabase/client'
import type { SupabasePublicConfig } from '@/lib/supabase/env'
import { joinWaitlist } from '@/lib/waitlist'
import { fireWaitlistConfetti } from '@/lib/waitlist-confetti'
import '@/components/landing/landing.css'
import './waitlist.css'
import { WaitlistModelsSection } from './WaitlistModelsSection'
import { WaitlistProductSections, WaitlistSiteFooter } from './WaitlistPageSections'

type WaitlistPageProps = {
  supabaseConfig: SupabasePublicConfig | null
  siteOrigin?: string
}

export function WaitlistPage({ supabaseConfig }: WaitlistPageProps) {
  const router = useRouter()
  const [activeConfig, setActiveConfig] = useState<SupabasePublicConfig | null>(supabaseConfig)
  const [configChecked, setConfigChecked] = useState(supabaseConfig !== null)
  const signupEnabled = activeConfig !== null
  const searchParams = useSearchParams()
  const countdown = useLaunchCountdown()
  const isLive = countdown?.isLive ?? false
  const [joined, setJoined] = useState(false)

  const scrollToFaq = useCallback(() => {
    document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (!configChecked) return

    if (searchParams.get('error') === 'config' && signupEnabled) {
      router.replace('/')
    }
  }, [configChecked, signupEnabled, searchParams, router])

  useEffect(() => {
    if (!joined) return
    void fireWaitlistConfetti()
  }, [joined])

  useEffect(() => {
    if (activeConfig) {
      setConfigChecked(true)
      return
    }
    void fetch('/api/waitlist/config')
      .then((r) => r.json())
      .then((d: { enabled?: boolean; url?: string; key?: string }) => {
        if (d.enabled && d.url && d.key) {
          setActiveConfig({ url: d.url, key: d.key })
        }
      })
      .catch(() => undefined)
      .finally(() => setConfigChecked(true))
  }, [activeConfig])

  const completeJoin = useCallback(async () => {
    const supabase = createClient(activeConfig)
    if (!supabase) return
    const result = await joinWaitlist(supabase)
    if (result.ok) {
      setJoined(true)
      scrollToFaq()
    }
  }, [activeConfig, scrollToFaq])

  useEffect(() => {
    if (
      searchParams.get('checkout') === 'success' ||
      searchParams.get('joined') === '1'
    ) {
      setJoined(true)
      scrollToFaq()
      return
    }
    if (
      searchParams.get('error') === 'auth' ||
      searchParams.get('error') === 'config' ||
      searchParams.get('error') === 'waitlist'
    ) {
      scrollToFaq()
      return
    }

    if (!signupEnabled || isLive) return

    const supabase = createClient(activeConfig)
    if (!supabase) return
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        void completeJoin()
      }
    })
  }, [searchParams, completeJoin, scrollToFaq, signupEnabled, activeConfig, isLive])

  return (
    <div className="landing-root waitlist-page">
      <HeroScrollSection isLive={isLive} onJoin={scrollToFaq} />

      <ClarifiBentoSection />

      <WaitlistModelsSection />

      <FeaturedSectionStats />

      <WaitlistProductSections />

      <FaqSection className="waitlist-faq" />

      <WaitlistSiteFooter />
    </div>
  )
}
