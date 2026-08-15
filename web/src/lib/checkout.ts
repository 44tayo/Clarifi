import type { BillingInterval, PricingPlanId } from '@/lib/pricing'

export type CheckoutPlan = 'pro' | 'pro_plus'

export function checkoutHref(
  planId: PricingPlanId | CheckoutPlan,
  interval: BillingInterval = 'monthly',
): string {
  const planParam = planId === 'pro_plus' ? 'pro_plus' : 'pro'
  return `/checkout?plan=${planParam}&interval=${interval}`
}

export function parseCheckoutPlan(plan: string | undefined): CheckoutPlan | null {
  if (plan === 'pro' || plan === 'pro_plus') return plan
  return null
}

export function parseCheckoutInterval(interval: string | undefined): BillingInterval {
  return interval === 'annual' ? 'annual' : 'monthly'
}
