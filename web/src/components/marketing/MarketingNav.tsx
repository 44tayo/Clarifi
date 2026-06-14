'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { previewHref } from '@/lib/launch-preview'
import { useLaunchCountdown } from '@/hooks/useLaunchCountdown'
import '@/components/landing/landing.css'

type MarketingNavProps = {
  active?: 'blog' | 'pricing'
  showBack?: boolean
}

export function MarketingNav({ active, showBack = false }: MarketingNavProps) {
  const [scrolled, setScrolled] = useState(false)
  const countdown = useLaunchCountdown()
  const isLive = countdown?.isLive ?? false

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToJoin = useCallback(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/') {
      document.getElementById('join')?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    window.location.href = '/#join'
  }, [])

  return (
    <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="landing-nav-inner">
        {showBack && (
          <Link href="/" className="landing-nav-back" aria-label="Back to home">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        )}
        <Link href="/" className="landing-nav-logo">
          <span className="landing-nav-logo-icon">
            <Image
              src="/clarifi-logo.png"
              alt="Clarifi"
              width={32}
              height={32}
              className="landing-logo-img"
            />
          </span>
          Clarifi
        </Link>
        <div className="landing-nav-links">
          <Link
            href="/blog"
            className={`landing-nav-link${active === 'blog' ? ' landing-nav-link-active' : ''}`}
          >
            Blog
          </Link>
          <Link
            href="/pricing"
            className={`landing-nav-link${active === 'pricing' ? ' landing-nav-link-active' : ''}`}
          >
            Pricing
          </Link>
        </div>
        {isLive ? (
          <Link href={previewHref('/dashboard')} className="landing-cta landing-nav-cta">
            Dashboard
          </Link>
        ) : (
          <button
            type="button"
            className="landing-cta landing-nav-cta"
            onClick={scrollToJoin}
          >
            Join the waitlist
          </button>
        )}
      </div>
    </nav>
  )
}
