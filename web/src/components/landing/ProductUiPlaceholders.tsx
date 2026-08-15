'use client'

import { useState } from 'react'

import { DesktopStage } from '@/components/landing/DesktopStage'
import './product-ui-placeholders.css'

/**
 * Drop Retina PNGs here (then refresh):
 *   public/marketing/hero-home.png
 *   public/marketing/hero-notes.png
 *
 * Until those files exist, labeled placeholders show in Mac chrome.
 */
const SLOTS = [
  {
    id: 'home',
    src: '/marketing/hero-home.png',
    label: 'Home — Coming up',
    hint: 'public/marketing/hero-home.png',
  },
  {
    id: 'notes',
    src: '/marketing/hero-notes.png',
    label: 'Meeting notes',
    hint: 'public/marketing/hero-notes.png',
  },
] as const

function ScreenshotSlot({
  src,
  label,
  hint,
}: {
  src: string
  label: string
  hint: string
}) {
  const [ready, setReady] = useState(false)

  return (
    <div className="product-ui-slot">
      {/* Probe for optional drop-in; stay on placeholder until it loads. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden
        className="product-ui-probe"
        onLoad={() => setReady(true)}
        onError={() => setReady(false)}
      />
      {ready ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="product-ui-shot" />
      ) : (
        <div className="product-ui-placeholder" role="img" aria-label={`${label} placeholder`}>
          <span className="product-ui-placeholder-label">{label}</span>
          <span className="product-ui-placeholder-hint">Add screenshot</span>
          <code className="product-ui-placeholder-path">{hint}</code>
        </div>
      )}
    </div>
  )
}

export function ProductUiPlaceholders() {
  return (
    <div className="product-ui-showcase" id="demo">
      <div className="product-ui-glow" aria-hidden />
      <div className="product-ui-screen">
        <DesktopStage>
          <div className="product-ui-grid">
            {SLOTS.map((slot) => (
              <ScreenshotSlot key={slot.id} {...slot} />
            ))}
          </div>
        </DesktopStage>
      </div>
      <p className="product-ui-caption">
        Placeholders for real Clarifi UI — drop PNGs into <code>public/marketing/</code>
      </p>
    </div>
  )
}
