import { getStripe } from './stripe'
import { getSupabaseAdmin } from './supabase-admin'

export type SubscriptionTrialInfo = {
  trialEndsAt: string | null
  subscriptionStatus: string | null
  trialActive: boolean
}

const TRIAL_DAYS = 30

function trialActiveFrom(endsAtIso: string | null, status: string | null): boolean {
  if (status === 'trialing') return true
  if (!endsAtIso) return false
  const ends = Date.parse(endsAtIso)
  return Number.isFinite(ends) && ends > Date.now()
}

/** Persist Stripe trial fields onto profiles (best-effort; no-op if columns missing). */
export async function writeProfileTrialFields(
  userId: string,
  input: {
    trialEndsAt: string | null
    subscriptionStatus: string | null
  },
): Promise<void> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return
  const { error } = await supabase
    .from('profiles')
    .update({
      trial_ends_at: input.trialEndsAt,
      subscription_status: input.subscriptionStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  if (error) {
    // Columns may not be migrated yet — Stripe fetch still powers the UI.
    console.warn('[trial] profile write skipped:', error.message)
  }
}

/**
 * Resolve the user's Stripe 30-day trial end for desktop UI.
 * Uses profiles cache when present; otherwise reads Stripe via subscription id.
 */
export async function getSubscriptionTrialInfo(userId: string): Promise<SubscriptionTrialInfo> {
  const empty: SubscriptionTrialInfo = {
    trialEndsAt: null,
    subscriptionStatus: null,
    trialActive: false,
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) return empty

  const { data, error } = await supabase
    .from('profiles')
    .select('trial_ends_at, subscription_status, stripe_subscription_id')
    .eq('user_id', userId)
    .maybeSingle()

  let trialEndsAt: string | null = null
  let subscriptionStatus: string | null = null
  let subscriptionId: string | null = null

  if (!error && data) {
    trialEndsAt =
      typeof data.trial_ends_at === 'string' && data.trial_ends_at.trim()
        ? data.trial_ends_at
        : null
    subscriptionStatus =
      typeof data.subscription_status === 'string' && data.subscription_status.trim()
        ? data.subscription_status
        : null
    subscriptionId =
      typeof data.stripe_subscription_id === 'string' && data.stripe_subscription_id.trim()
        ? data.stripe_subscription_id
        : null
  } else {
    // Older schemas without trial columns — still resolve via subscription id.
    const fallback = await supabase
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('user_id', userId)
      .maybeSingle()
    subscriptionId =
      typeof fallback.data?.stripe_subscription_id === 'string' &&
      fallback.data.stripe_subscription_id.trim()
        ? fallback.data.stripe_subscription_id
        : null
  }

  const needsStripeRefresh =
    Boolean(subscriptionId) &&
    (subscriptionStatus == null || subscriptionStatus === 'trialing')

  if (needsStripeRefresh && subscriptionId) {
    const stripe = getStripe()
    if (stripe) {
      try {
        const sub = await stripe.subscriptions.retrieve(subscriptionId)
        subscriptionStatus = sub.status
        trialEndsAt =
          sub.status === 'trialing' && typeof sub.trial_end === 'number'
            ? new Date(sub.trial_end * 1000).toISOString()
            : null
        await writeProfileTrialFields(userId, { trialEndsAt, subscriptionStatus })
      } catch (err) {
        console.error('[trial] stripe retrieve failed:', err)
      }
    }
  }

  return {
    trialEndsAt,
    subscriptionStatus,
    trialActive: trialActiveFrom(trialEndsAt, subscriptionStatus),
  }
}

export function trialDayProgress(trialEndsAtIso: string): {
  daysLeft: number
  daysUsed: number
  ratio: number
  totalDays: number
} {
  const ends = Date.parse(trialEndsAtIso)
  if (!Number.isFinite(ends)) {
    return { daysLeft: 0, daysUsed: TRIAL_DAYS, ratio: 1, totalDays: TRIAL_DAYS }
  }
  const dayMs = 24 * 60 * 60 * 1000
  const starts = ends - TRIAL_DAYS * dayMs
  const now = Date.now()
  const daysLeft = Math.max(0, Math.ceil((ends - now) / dayMs))
  const daysUsed = Math.min(TRIAL_DAYS, Math.max(0, Math.floor((now - starts) / dayMs)))
  const ratio = Math.min(1, Math.max(0, daysUsed / TRIAL_DAYS))
  return { daysLeft, daysUsed, ratio, totalDays: TRIAL_DAYS }
}
