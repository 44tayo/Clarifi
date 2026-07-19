import Stripe from 'stripe'
import { type BillingInterval } from './pricing'
import { type Plan } from './plans'
import { getSupabaseAdmin } from './supabase-admin'

let stripeClient: Stripe | null = null

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) return null
  if (!stripeClient) {
    stripeClient = new Stripe(key)
  }
  return stripeClient
}

export function planFromPriceId(priceId: string | undefined | null): Plan {
  if (!priceId) return 'free'
  const proMonthly = process.env.STRIPE_PRICE_PRO?.trim()
  const proAnnual = process.env.STRIPE_PRICE_PRO_ANNUAL?.trim()
  const proPlusMonthly = process.env.STRIPE_PRICE_PRO_PLUS?.trim()
  const proPlusAnnual = process.env.STRIPE_PRICE_PRO_PLUS_ANNUAL?.trim()

  if (priceId === proMonthly || priceId === proAnnual) return 'pro'
  if (priceId === proPlusMonthly || priceId === proPlusAnnual) return 'pro_plus'
  return 'free'
}

export function priceIdForPlan(
  plan: 'pro' | 'pro_plus',
  interval: BillingInterval = 'monthly',
): string | null {
  if (plan === 'pro') {
    return interval === 'annual'
      ? process.env.STRIPE_PRICE_PRO_ANNUAL?.trim() || null
      : process.env.STRIPE_PRICE_PRO?.trim() || null
  }
  return interval === 'annual'
    ? process.env.STRIPE_PRICE_PRO_PLUS_ANNUAL?.trim() || null
    : process.env.STRIPE_PRICE_PRO_PLUS?.trim() || null
}

export type CheckoutSessionInput = {
  userId: string
  email?: string | null
  plan: 'pro' | 'pro_plus'
  interval: BillingInterval
  origin: string
}

export async function createStripeCheckoutSession(
  input: CheckoutSessionInput,
): Promise<{ url: string | null; error?: string }> {
  const stripe = getStripe()
  if (!stripe) return { url: null, error: 'stripe_not_configured' }

  const priceId = priceIdForPlan(input.plan, input.interval)
  if (!priceId) return { url: null, error: 'price_not_configured' }

  const origin = input.origin.replace(/\/$/, '')

  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${origin}/billing?checkout=success`,
    cancel_url: `${origin}/billing?checkout=cancelled`,
    client_reference_id: input.userId,
    customer_email: input.email ?? undefined,
    metadata: {
      userId: input.userId,
      plan: input.plan,
      interval: input.interval,
    },
    // No trial period — there's a genuine free plan (unlimited meetings, 30
    // days of history) before users ever reach checkout, so paid plans bill
    // immediately for the unlimited-history/team features they unlock.
    subscription_data: {
      metadata: {
        userId: input.userId,
        plan: input.plan,
        interval: input.interval,
      },
    },
  })

  return { url: checkout.url }
}

export async function createStripeBillingPortalSession(input: {
  customerId: string
  origin: string
}): Promise<{ url: string | null; error?: string }> {
  const stripe = getStripe()
  if (!stripe) return { url: null, error: 'stripe_not_configured' }

  const origin = input.origin.replace(/\/$/, '')
  const session = await stripe.billingPortal.sessions.create({
    customer: input.customerId,
    return_url: `${origin}/dashboard`,
  })

  return { url: session.url }
}

/** Resolve Stripe customer ID from profile or email lookup, optionally backfilling Supabase. */
export async function resolveStripeCustomerId(input: {
  userId: string
  email?: string | null
  storedCustomerId?: string | null
}): Promise<string | null> {
  if (input.storedCustomerId) return input.storedCustomerId

  const stripe = getStripe()
  if (!stripe || !input.email) return null

  const customers = await stripe.customers.list({ email: input.email, limit: 1 })
  const customerId = customers.data[0]?.id ?? null
  if (!customerId) return null

  const supabase = getSupabaseAdmin()
  if (supabase) {
    await supabase
      .from('profiles')
      .upsert(
        {
          user_id: input.userId,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
  }

  return customerId
}
