import { getServerUser } from '@/lib/auth-server'
import { getSiteOrigin } from '@/lib/site-url'
import {
  createStripeBillingPortalSession,
  resolveStripeCustomerId,
} from '@/lib/stripe'
import { getUserBillingProfile } from '@/lib/usage'

export async function POST(req: Request) {
  const user = await getServerUser()
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const billing = await getUserBillingProfile(user.id)
  const customerId = await resolveStripeCustomerId({
    userId: user.id,
    email: user.email,
    storedCustomerId: billing.stripeCustomerId,
  })

  if (!customerId) {
    return Response.json({ error: 'no_stripe_customer' }, { status: 404 })
  }

  const origin = getSiteOrigin(new URL(req.url).origin)
  const { url, error } = await createStripeBillingPortalSession({
    customerId,
    origin,
  })

  if (error === 'stripe_not_configured') {
    return Response.json({ error: 'stripe_not_configured' }, { status: 503 })
  }

  if (!url) {
    return Response.json({ error: 'portal_unavailable' }, { status: 503 })
  }

  return Response.json({ url })
}
