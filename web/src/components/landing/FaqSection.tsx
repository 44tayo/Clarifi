'use client'

import { useState } from 'react'
import { FAQ_ITEMS } from '@/lib/faq-items'

type FaqSectionProps = {
  className?: string
}

export function FaqSection({ className = '' }: FaqSectionProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <section
      id="faq"
      className={`landing-section landing-faq-section ${className}`.trim()}
      data-reveal
    >
      <div className="landing-section-header">
        <h2>Frequently asked questions</h2>
      </div>
      {FAQ_ITEMS.map((item, i) => (
        <div key={item.q} className={`landing-faq-item ${openFaq === i ? 'open' : ''}`}>
          <button
            type="button"
            className="landing-faq-trigger"
            onClick={() => setOpenFaq(openFaq === i ? null : i)}
            aria-expanded={openFaq === i}
          >
            {item.q}
            <span className="landing-faq-chevron" aria-hidden>
              ▼
            </span>
          </button>
          <div className="landing-faq-content">{item.a}</div>
        </div>
      ))}
    </section>
  )
}
