'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { PricingCheckoutButton } from '@/components/pricing/PricingCheckoutButton'
import { type BillingInterval, PRICING_FEATURES, getPricingPlans, maxAnnualSavingsPercent } from '@/lib/pricing'
import '@/components/landing/landing.css'
import './pricing.css'

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 8.5L6.5 11.5L12.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M5 5L11 11M11 5L5 11"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function PricingPage() {
  const searchParams = useSearchParams()
  const checkoutSuccess = searchParams.get('checkout') === 'success'
  const [billing, setBilling] = useState<BillingInterval>('monthly')
  const plans = getPricingPlans(billing)
  const maxSavingsPercent = maxAnnualSavingsPercent()

  return (
    <div className="landing-root pricing-page">
      <MarketingNav active="pricing" showBack />

      <main className="pricing-main">
        <div className="pricing-hero-glow pricing-hero-glow-a" aria-hidden />
        <div className="pricing-hero-glow pricing-hero-glow-b" aria-hidden />

        {checkoutSuccess && (
          <p className="pricing-checkout-success" role="status">
            Payment received — thanks for subscribing. Sign in to link your plan to your account.
          </p>
        )}

        <section className="pricing-hero" data-reveal>
          <h1 className="pricing-hero-title">Try Clarifi free for 30 days.</h1>
          <p className="pricing-hero-sub">
            Pro and Pro+ both include a 30-day free trial. Cancel anytime before it ends — no charge
            until the trial is over.
          </p>

          <div className="pricing-toggles">
            <div className="pricing-billing-toggle" role="tablist" aria-label="Billing interval">
              <button
                type="button"
                role="tab"
                aria-selected={billing === 'monthly'}
                className={billing === 'monthly' ? 'active' : ''}
                onClick={() => setBilling('monthly')}
              >
                Monthly
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={billing === 'annual'}
                className={billing === 'annual' ? 'active' : ''}
                onClick={() => setBilling('annual')}
              >
                Annual
                <span className="pricing-savings-pill">Save up to {maxSavingsPercent}%</span>
              </button>
            </div>

            <div className="pricing-billing-note">
              {billing === 'annual'
                ? `Save up to ${maxSavingsPercent}% vs monthly · cancel anytime`
                : 'Billed monthly · cancel anytime'}
            </div>
          </div>
        </section>

        <section className="pricing-cards" data-reveal-group>
          {plans.map((plan) => (
            <article
              key={plan.id}
              className={`pricing-card${plan.id === 'pro_plus' ? ' pricing-card-featured' : ''}`}
              data-reveal
            >
              <div className="pricing-card-head">
                <p className="pricing-card-audience">{plan.audience}</p>
                <h2 className="pricing-card-name">
                  {plan.name}
                  {plan.badge ? <span className="pricing-card-badge">{plan.badge}</span> : null}
                </h2>
                <div className="pricing-card-price">
                  <span className="pricing-card-amount">{plan.price}</span>
                  {plan.period ? (
                    <span className="pricing-card-period">{plan.period}</span>
                  ) : null}
                </div>
                {plan.billedNote ? (
                  <p className="pricing-card-billed">{plan.billedNote}</p>
                ) : null}
                {plan.savingsNote ? (
                  <p className="pricing-card-savings">{plan.savingsNote}</p>
                ) : null}
              </div>

              <PricingCheckoutButton
                planId={plan.id}
                interval={billing}
                className="pricing-card-cta"
              >
                {plan.cta}
              </PricingCheckoutButton>

              <p className="pricing-card-tagline">{plan.tagline}</p>

              <ul className="pricing-card-features">
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <span className="pricing-feature-check" aria-hidden>
                      <CheckIcon />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="pricing-compare" data-reveal>
          <h2 className="pricing-compare-title">Features</h2>
          <div className="pricing-compare-grid">
            <div className="pricing-compare-header">
              <span />
              <span>Pro · Individual</span>
              <span>Pro+ · Team</span>
            </div>
            {PRICING_FEATURES.map((row) => (
              <div key={row.label} className="pricing-compare-row">
                <span className="pricing-compare-label">{row.label}</span>
                {(['pro', 'proPlus'] as const).map((col) => {
                  const value = row[col]
                  return (
                    <span key={col} className="pricing-compare-cell">
                      {typeof value === 'boolean' ? (
                        value ? (
                          <span className="pricing-compare-yes">
                            <CheckIcon />
                          </span>
                        ) : (
                          <span className="pricing-compare-no">
                            <XIcon />
                          </span>
                        )
                      ) : (
                        value
                      )}
                    </span>
                  )
                })}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
