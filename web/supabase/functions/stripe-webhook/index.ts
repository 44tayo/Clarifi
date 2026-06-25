import Stripe from 'npm:stripe@17.7.0'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function planFromPriceId(priceId: string | undefined | null): 'free' | 'pro' | 'pro_plus' {
  if (!priceId) return 'free'
  const proMonthly = Deno.env.get('STRIPE_PRICE_PRO')
  const proAnnual = Deno.env.get('STRIPE_PRICE_PRO_ANNUAL')
  const proPlusMonthly = Deno.env.get('STRIPE_PRICE_PRO_PLUS')
  const proPlusAnnual = Deno.env.get('STRIPE_PRICE_PRO_PLUS_ANNUAL')

  if (priceId === proMonthly || priceId === proAnnual) return 'pro'
  if (priceId === proPlusMonthly || priceId === proPlusAnnual) return 'pro_plus'
  return 'free'
}

type SubMoney = {
  plan: 'free' | 'pro' | 'pro_plus'
  quantity: number
  amount_cents: number
  currency: string
  billing_interval: 'month' | 'year'
}

function subscriptionMoney(sub: Stripe.Subscription): SubMoney {
  const item = sub.items.data[0]
  const price = item?.price
  const quantity = item?.quantity ?? 1
  const unit = price?.unit_amount ?? 0
  return {
    plan: planFromPriceId(price?.id),
    quantity,
    amount_cents: unit * quantity,
    currency: price?.currency ?? 'usd',
    billing_interval: price?.recurring?.interval === 'year' ? 'year' : 'month',
  }
}

type BillingEventInput = {
  eventType:
    | 'trial_started'
    | 'trial_ended'
    | 'billing_started'
    | 'billing_updated'
    | 'billing_canceled'
  stripeEventId: string
  userId: string | null
  eventAt: string
  sub?: Stripe.Subscription | null
  customerId?: string | null
}

/** Best-effort event logging — never throws, so it can't break the billing upsert. */
async function logBillingEvent(
  supabase: SupabaseClient,
  input: BillingEventInput,
): Promise<void> {
  try {
    let email: string | null = null
    let platform: string | null = null
    if (input.userId) {
      const { data } = await supabase
        .from('profiles')
        .select('email, platform')
        .eq('user_id', input.userId)
        .maybeSingle()
      email = data?.email ?? null
      platform = data?.platform ?? null
    }

    const money = input.sub ? subscriptionMoney(input.sub) : null

    await supabase.from('billing_events').upsert(
      {
        event_type: input.eventType,
        user_id: input.userId,
        email,
        plan: money?.plan ?? null,
        quantity: money?.quantity ?? 1,
        amount_cents: money?.amount_cents ?? null,
        currency: money?.currency ?? 'usd',
        billing_interval: money?.billing_interval ?? null,
        platform,
        stripe_customer_id:
          input.customerId ??
          (typeof input.sub?.customer === 'string' ? input.sub.customer : null),
        stripe_subscription_id: input.sub?.id ?? null,
        stripe_event_id: input.stripeEventId,
        event_at: input.eventAt,
      },
      { onConflict: 'stripe_event_id', ignoreDuplicates: true },
    )
  } catch (err) {
    console.error('logBillingEvent failed:', err)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  // SUPABASE_URL is injected automatically by Supabase — do not add it as a secret
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')

  if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Server not configured' }, 503)
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' })
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const signature = req.headers.get('stripe-signature')
  if (!signature) return json({ error: 'Missing signature' }, 400)

  const body = await req.text()
  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    console.error('Stripe signature error:', err)
    return json({ error: 'Invalid signature' }, 400)
  }

  const eventAt = new Date(event.created * 1000).toISOString()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId =
      session.metadata?.userId ||
      session.metadata?.clerkUserId ||
      session.client_reference_id ||
      null
    const plan = session.metadata?.plan === 'pro_plus' ? 'pro_plus' : 'pro'

    if (userId) {
      await supabase.from('profiles').upsert({
        user_id: userId,
        plan,
        stripe_customer_id:
          typeof session.customer === 'string' ? session.customer : null,
        stripe_subscription_id:
          typeof session.subscription === 'string' ? session.subscription : null,
        updated_at: new Date().toISOString(),
      })
    }

    // Checkout with a trial lands the subscription in `trialing`; without a
    // trial it lands `active`. Retrieve it to log the right event + amount.
    if (typeof session.subscription === 'string') {
      try {
        const sub = await stripe.subscriptions.retrieve(session.subscription)
        const eventType =
          sub.status === 'trialing' ? 'trial_started' : 'billing_started'
        await logBillingEvent(supabase, {
          eventType,
          stripeEventId: event.id,
          userId,
          eventAt,
          sub,
        })
      } catch (err) {
        console.error('subscription retrieve failed:', err)
      }
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription
    const previous = event.data.previous_attributes as
      | Partial<Stripe.Subscription>
      | undefined
    const userId =
      subscription.metadata?.userId || subscription.metadata?.clerkUserId || null

    const active =
      subscription.status === 'active' || subscription.status === 'trialing'
    const priceId = subscription.items.data[0]?.price?.id
    const plan = active ? planFromPriceId(priceId) : 'free'

    if (userId) {
      await supabase.from('profiles').upsert({
        user_id: userId,
        plan,
        stripe_customer_id:
          typeof subscription.customer === 'string' ? subscription.customer : null,
        stripe_subscription_id: active ? subscription.id : null,
        updated_at: new Date().toISOString(),
      })
    }

    // Trial → paid conversion is the moment billing actually starts.
    if (previous?.status === 'trialing' && subscription.status === 'active') {
      await logBillingEvent(supabase, {
        eventType: 'billing_started',
        stripeEventId: event.id,
        userId,
        eventAt,
        sub: subscription,
      })
    } else if (subscription.status === 'active' && previous?.items !== undefined) {
      // Plan or seat change on an already-paying subscription.
      await logBillingEvent(supabase, {
        eventType: 'billing_updated',
        stripeEventId: event.id,
        userId,
        eventAt,
        sub: subscription,
      })
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const userId =
      subscription.metadata?.userId || subscription.metadata?.clerkUserId || null

    if (userId) {
      await supabase.from('profiles').upsert({
        user_id: userId,
        plan: 'free',
        stripe_customer_id:
          typeof subscription.customer === 'string' ? subscription.customer : null,
        stripe_subscription_id: null,
        updated_at: new Date().toISOString(),
      })
    }

    await logBillingEvent(supabase, {
      eventType: 'billing_canceled',
      stripeEventId: event.id,
      userId,
      eventAt,
      sub: subscription,
    })
  }

  return json({ received: true })
})
