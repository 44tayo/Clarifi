'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { ComingSoonModal } from '@/components/landing/ComingSoonModal'
import './waitlist-page-sections.css'

const PRODUCT_BENEFITS = [
  {
    title: 'Completely Undetectable',
    description: "Invisible on your screen and on screen share. No one knows it's there.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    ),
  },
  {
    title: 'Always on Standby',
    description: 'Clarifi is ready the moment you need it, with zero lag or setup.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    title: 'Unlimited Usage',
    description: 'No caps, no paywalls mid-session. Use it as much as you need.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.581 0-4.581 8 0 8 5.606 0 7.644-8 12.739-8z" />
      </svg>
    ),
  },
  {
    title: 'Fully Customisable',
    description:
      'Tailored to your workflow, industry, and use case — with your choice of the best AI models.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
      </svg>
    ),
  },
  {
    title: '3x Cheaper',
    description: 'A third of the cost of leading tools in the space, with more flexibility.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    title: 'Real-Time Answers',
    description:
      'Watches your screen and listens to your audio to deliver instant, accurate answers when you need them most.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
] as const

function ClarifiLogoMark() {
  return (
    <Image
      src="/clarifi-logo.png"
      alt=""
      width={32}
      height={32}
      className="landing-logo-img"
      aria-hidden
    />
  )
}

export function WaitlistProductSections() {
  return (
    <>
      <section className="waitlist-benefits" aria-labelledby="why-clarifi-heading" data-reveal>
        <div className="waitlist-benefits-inner">
          <h2 id="why-clarifi-heading" className="waitlist-section-heading" data-reveal>
            Why Clarifi?
          </h2>
          <div className="waitlist-benefits-grid" data-reveal-group>
            {PRODUCT_BENEFITS.map((benefit) => (
              <article key={benefit.title} className="waitlist-benefit-card" data-reveal>
                <div className="waitlist-benefit-card-top">
                  <div className="waitlist-benefit-icon">{benefit.icon}</div>
                </div>
                <h3 className="waitlist-benefit-title">{benefit.title}</h3>
                <p className="waitlist-benefit-desc">{benefit.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

export function WaitlistSiteFooter() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <footer className="landing-footer waitlist-site-footer" data-reveal>
      <div className="landing-footer-main">
        <div className="landing-footer-brand-col">
          <a href="/" className="landing-footer-logo">
            <span className="landing-footer-logo-icon">
              <ClarifiLogoMark />
            </span>
            <span className="landing-footer-logo-text">Clarifi</span>
          </a>
          <span className="landing-footer-status">● All systems operational</span>
          <p className="waitlist-footer-subprocessors">
            List of{' '}
            <Link href="/subprocessors">subprocessors</Link>.
          </p>
        </div>

        <div className="landing-footer-columns">
          <div className="landing-footer-col">
            <h4>Resources</h4>
            <button
              type="button"
              className="landing-footer-link-btn"
              onClick={() => setMobileOpen(true)}
            >
              Mobile <span className="landing-footer-badge">New</span>
            </button>
            <Link href="/blog" className="landing-footer-link-btn">
              Blog
            </Link>
          </div>
          <div className="landing-footer-col">
            <h4>Support</h4>
            <button type="button" className="landing-footer-link-btn" disabled>
              Help Center
            </button>
            <a href="mailto:tayowilliams23@gmail.com" className="landing-footer-link-btn">
              Contact Us
            </a>
          </div>
          <div className="landing-footer-col">
            <h4>Legal</h4>
            <Link href="/privacy" className="landing-footer-link-btn">
              Privacy Policy
            </Link>
            <Link href="/terms" className="landing-footer-link-btn">
              Terms of Service
            </Link>
            <Link href="/subprocessors" className="landing-footer-link-btn">
              Subprocessors
            </Link>
          </div>
        </div>
      </div>

      <div className="landing-footer-bottom">
        <span className="landing-footer-copy">© 2026 Clarifi. All rights reserved.</span>
        <div className="landing-footer-social">
          <a href="https://x.com/Clarifi_ai" target="_blank" rel="noopener noreferrer" aria-label="X">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://www.linkedin.com/company/clarifiapp/?viewAsMember=true"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </a>
        </div>
      </div>

      <ComingSoonModal
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        overlayClassName="waitlist-frosted-overlay"
        modalClassName="waitlist-frosted-modal"
      />
    </footer>
  )
}
