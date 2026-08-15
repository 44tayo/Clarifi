'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useMemo } from 'react'

import { DownloadWithInstallModal } from '@/components/DownloadWithInstallModal'
import { cn } from '@/lib/utils'

/** Nav chrome styles — imported here so every page that mounts MarketingNav gets the same bar. */
import '@/components/landing/landing.css'

type MarketingNavProps = {
  active?: 'blog' | 'pricing' | 'privacy' | 'terms'
  variant?: 'default' | 'hero'
}

export function MarketingNav({ active, variant = 'default' }: MarketingNavProps) {
  const isHero = variant === 'hero'

  const links = useMemo(
    () => [
      { label: 'Demo', href: '/#demo', active: false },
      { label: 'Features', href: '/#features', active: false },
      { label: 'FAQ', href: '/#faq', active: false },
      { label: 'Blog', href: '/blog', active: active === 'blog' },
      { label: 'Pricing', href: '/pricing', active: active === 'pricing' },
      { label: 'Privacy', href: '/privacy', active: active === 'privacy' },
      { label: 'Terms', href: '/terms', active: active === 'terms' },
    ],
    [active],
  )

  const handleSectionClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      if (!href.startsWith('/#')) return
      if (window.location.pathname !== '/') return

      const id = href.slice(2)
      const target = document.getElementById(id)
      if (!target) return

      event.preventDefault()
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.history.pushState(null, '', href)
    },
    [],
  )

  return (
    <header className={cn('landing-nav', isHero && 'landing-nav-hero')}>
      <div className="landing-nav-inner">
        <Link href="/" className="landing-nav-logo">
          <span className="landing-nav-logo-icon">
            <Image
              src="/clarifi-logo.png"
              alt=""
              width={32}
              height={32}
              className="landing-logo-img"
            />
          </span>
          Clarifi
        </Link>

        <nav className="landing-nav-links" aria-label="Main">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={(event) => handleSectionClick(event, link.href)}
              className={cn('landing-nav-link', link.active && 'landing-nav-link-active')}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="landing-nav-cta-group">
          <Link href="/sign-in?next=/dashboard" className="landing-nav-login">
            Login
          </Link>
          <DownloadWithInstallModal
            variant="compact"
            buttonStyle="landing"
            className="landing-nav-download download-mac-btn"
          />
        </div>
      </div>
    </header>
  )
}
