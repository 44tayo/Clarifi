'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { checkoutHref } from '@/lib/checkout'
import { getPricingPlans, maxAnnualSavingsPercent, type BillingInterval } from '@/lib/pricing'

export default function BillingClient() {
  const searchParams = useSearchParams()
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const checkoutStatus = searchParams.get('checkout')
  const plans = getPricingPlans(interval)

  useEffect(() => {
    const fromQuery = searchParams.get('interval')
    if (fromQuery === 'annual' || fromQuery === 'monthly') {
      setInterval(fromQuery)
    }
  }, [searchParams])

  const startCheckout = useCallback(
    async (plan: 'free' | 'pro' | 'pro_plus', billingInterval: BillingInterval = interval) => {
      if (plan === 'free') {
        window.location.href = '/sign-up'
        return
      }
      setLoadingPlan(plan)
      setError(null)

      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan, interval: billingInterval }),
        })
        const data = await res.json()

        if (res.status === 401) {
          window.location.href = `/sign-in?next=${encodeURIComponent(checkoutHref(plan, billingInterval))}`
          return
        }

        if (!res.ok || !data.url) {
          setError(data.error || 'Checkout unavailable — configure Stripe price IDs')
          return
        }
        window.location.href = data.url
      } catch {
        setError('Network error — try again')
      } finally {
        setLoadingPlan(null)
      }
    },
    [interval],
  )

  return (
    <main className="min-h-screen bg-black text-white">
      <nav className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <Link href="/pricing" className="text-xl font-bold">
          Clarifi
        </Link>
        <Link href="/pricing" className="text-sm text-white/40 hover:text-white">
          ← Back to pricing
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-8 py-12">
        <h1 className="text-3xl font-bold mb-2">Choose your plan</h1>
        <p className="text-white/50 mb-6">
          Pro and Pro+ both include a 30-day free trial. You won&apos;t be charged until the trial
          ends — cancel anytime.
        </p>

        {checkoutStatus === 'success' && (
          <p className="text-sm text-emerald-400 mb-6 border border-emerald-400/30 rounded-lg p-4" role="status">
            Payment received — thanks for subscribing. Your plan will activate shortly.
          </p>
        )}

        {checkoutStatus === 'cancelled' && (
          <p className="text-sm text-white/60 mb-6 border border-white/10 rounded-lg p-4" role="status">
            Checkout cancelled. Pick a plan below when you&apos;re ready.
          </p>
        )}

        <div className="inline-flex p-1 mb-10 rounded-full border border-white/15 bg-white/5">
          <button
            type="button"
            onClick={() => setInterval('monthly')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${
              interval === 'monthly' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval('annual')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${
              interval === 'annual' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
            }`}
          >
            Annual
            <span className="ml-2 text-xs font-semibold text-emerald-400">
              Save up to {maxAnnualSavingsPercent()}%
            </span>
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-400 mb-6 border border-red-400/30 rounded-lg p-4">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plans.map((plan) => (
              <div
                key={plan.id}
                className={`p-6 rounded-2xl border ${
                  plan.id === 'pro_plus' ? 'border-white bg-white/5' : 'border-white/10'
                }`}
              >
                <p className="text-xs uppercase tracking-wide text-white/40 mb-2">{plan.audience}</p>
                <div className="text-2xl font-bold mb-1">
                  {plan.price}
                  <span className="text-base font-normal text-white/50">{plan.period}</span>
                </div>
                {interval === 'annual' && plan.billedNote ? (
                  <>
                    <div className="text-sm text-white/40 mb-1">{plan.billedNote}</div>
                    {plan.savingsNote ? (
                      <div className="text-sm font-medium text-emerald-400 mb-4">{plan.savingsNote}</div>
                    ) : null}
                  </>
                ) : (
                  <div className="text-sm text-white/40 mb-4">{plan.tagline}</div>
                )}
                <div className="font-medium mb-4">{plan.name}</div>
                <ul className="space-y-2 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="text-sm text-white/60 flex items-center gap-2">
                      <span className="text-green-400">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => startCheckout(plan.id, interval)}
                  disabled={loadingPlan === plan.id}
                  className="w-full py-3 rounded-xl text-sm font-medium bg-white text-black hover:bg-white/90 disabled:opacity-50"
                >
                  {loadingPlan === plan.id ? 'Redirecting…' : plan.cta}
                </button>
              </div>
            ))}
        </div>
      </div>
    </main>
  )
}
