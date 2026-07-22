'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useMemo } from 'react'

import { DownloadWithInstallModal } from '@/components/DownloadWithInstallModal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type MarketingNavProps = {
  active?: 'blog' | 'pricing' | 'privacy'
  showBack?: boolean
  variant?: 'default' | 'hero'
}

export function MarketingNav({ active, showBack = false, variant = 'default' }: MarketingNavProps) {
  const isHero = variant === 'hero'

  const links = useMemo(
    () => [
      { label: 'Demo', href: '/#demo', active: false },
      { label: 'Features', href: '/#features', active: false },
      { label: 'FAQ', href: '/#faq', active: false },
      { label: 'Blog', href: '/blog', active: active === 'blog' },
      { label: 'Pricing', href: '/pricing', active: active === 'pricing' },
      { label: 'Privacy', href: '/privacy', active: active === 'privacy' },
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
        {showBack ? (
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
        ) : null}

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
          {isHero ? (
            <Button
              variant="outline"
              size="default"
              className="border-white/35 bg-white/[0.08] text-white hover:bg-white/[0.14] hover:text-white"
              asChild
            >
              <Link href="/sign-in?next=/dashboard">Login</Link>
            </Button>
          ) : (
            <Link href="/sign-in?next=/dashboard" className="landing-nav-login">
              Login
            </Link>
          )}
          <DownloadWithInstallModal
            variant="compact"
            buttonStyle={isHero ? 'shadcn' : 'landing'}
            className={isHero ? undefined : 'landing-nav-download'}
          />
        </div>
      </div>
    </header>
  )
}
