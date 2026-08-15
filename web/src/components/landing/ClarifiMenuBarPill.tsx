'use client'

import Image from 'next/image'
import './clarifi-menu-bar-pill.css'

export function ClarifiMenuBarPill() {
  return (
    <div className="hero-menubar-pill" role="presentation">
      <button type="button" className="hero-pill-icon" aria-label="Clarifi" tabIndex={-1}>
        <Image src="/clarifi-logo.png" alt="" width={16} height={16} />
      </button>
      <button type="button" className="hero-pill-ask" tabIndex={-1}>
        <span className="hero-pill-sparkle" aria-hidden>
          ✦
        </span>
        Ask
      </button>
      <button type="button" className="hero-pill-stop" aria-label="Stop" tabIndex={-1}>
        <span className="hero-pill-stop-icon" aria-hidden />
      </button>
    </div>
  )
}
