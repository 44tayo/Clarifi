'use client'

import { HeroSalesDemo } from '@/components/landing/HeroSalesDemo'
import './sales-call-demo.css'

export function SalesCallDemo() {
  return (
    <div className="scd-page">
      <div className="scd-intro">
        <p className="scd-eyebrow">Live demo</p>
        <h1>Clarifi on a real meeting</h1>
        <p className="scd-sub">
          Your footage in a Zoom-style layout — Clarifi recording as your AI notepad, no bot on the
          guest list.
        </p>
      </div>

      <HeroSalesDemo />
    </div>
  )
}
