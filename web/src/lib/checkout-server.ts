import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth-server'
import { getSiteOrigin } from '@/lib/site-url'
import { createStripeCheckoutSession } from '@/lib/stripe'
import type { BillingInterval } from '@/lib/pricing'
import { checkoutHref, type CheckoutPlan } from '@/lib/checkout'

export async function resolveRequestOrigin(): Promise<string> {
  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host')
  const proto = headersList.get('x-forwarded-proto') ?? 'https'
  const requestOrigin = host ? `${proto}://${host}` : undefined
  return getSiteOrigin(requestOrigin)
}

/** Auth gate + Stripe redirect for /checkout (throws redirect()). */
export async function redirectCheckoutSession(
  plan: CheckoutPlan,
  interval: BillingInterval,
): Promise<void> {
  const user = await getServerUser()

  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(checkoutHref(plan, interval))}`)
  }

  const { url } = await createStripeCheckoutSession({
    userId: user.id,
    email: user.email,
    plan,
    interval,
    origin: await resolveRequestOrigin(),
  })

  if (url) redirect(url)
}
