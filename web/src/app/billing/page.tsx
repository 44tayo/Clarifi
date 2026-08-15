import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { checkoutHref, parseCheckoutInterval, parseCheckoutPlan } from '@/lib/checkout'
import BillingClient from './BillingClient'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{
    plan?: string
    interval?: string
    checkout?: string
  }>
}

export default async function BillingPage({ searchParams }: PageProps) {
  const params = await searchParams
  const plan = parseCheckoutPlan(params.plan)
  const checkoutStatus = params.checkout

  if (plan && checkoutStatus !== 'cancelled' && checkoutStatus !== 'success') {
    redirect(checkoutHref(plan, parseCheckoutInterval(params.interval)))
  }

  return (
    <Suspense>
      <BillingClient />
    </Suspense>
  )
}
