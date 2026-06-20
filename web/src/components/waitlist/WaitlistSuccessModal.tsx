'use client'

import { useEffect } from 'react'
import { fireWaitlistConfetti } from '@/lib/waitlist-confetti'

type WaitlistSuccessModalProps = {
  open: boolean
  onClose: () => void
}

export function WaitlistSuccessModal({ open, onClose }: WaitlistSuccessModalProps) {
  useEffect(() => {
    if (!open) return
    void fireWaitlistConfetti()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="waitlist-success-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="waitlist-success-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="waitlist-success-title"
      >
        <div className="waitlist-success-icon" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M7.5 12.5l3 3 6-7"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 id="waitlist-success-title" className="waitlist-success-title">
          You&apos;re on the list
        </h2>
        <p className="waitlist-success-body">
          Thanks for joining. We&apos;ll reach out just before launch with early access so you can
          pre-test Clarifi before everyone else.
        </p>
        <button type="button" className="waitlist-success-btn" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  )
}
