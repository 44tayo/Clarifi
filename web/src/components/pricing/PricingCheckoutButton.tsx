'use client'

import { useCallback, useState } from 'react'
import { checkoutHref } from '@/lib/checkout'
import type { BillingInterval, PricingPlanId } from '@/lib/pricing'

type PricingCheckoutButtonProps = {
  planId: PricingPlanId
  interval: BillingInterval
  className?: string
  children: React.ReactNode
}

export function PricingCheckoutButton({
  planId,
  interval,
  className,
  children,
}: PricingCheckoutButtonProps) {
  const [loading, setLoading] = useState(false)

  const startCheckout = useCallback(async () => {
    setLoading(true)

    const plan = planId === 'pro_plus' ? 'pro_plus' : 'pro'

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, interval }),
      })
      const data = await res.json()

      if (res.status === 401) {
        window.location.href = `/sign-in?next=${encodeURIComponent(checkoutHref(planId, interval))}`
        return
      }

      if (!res.ok || !data.url) {
        window.location.href = checkoutHref(planId, interval)
        return
      }

      window.location.href = data.url
    } catch {
      window.location.href = checkoutHref(planId, interval)
    } finally {
      setLoading(false)
    }
  }, [planId, interval])

  return (
    <button
      type="button"
      className={className}
      onClick={startCheckout}
      disabled={loading}
    >
      {loading ? 'Redirecting…' : children}
    </button>
  )
}
