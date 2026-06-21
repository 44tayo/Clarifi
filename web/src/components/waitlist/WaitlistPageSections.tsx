'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { ComingSoonModal } from '@/components/landing/ComingSoonModal'
import './waitlist-page-sections.css'

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
