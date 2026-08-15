import { redirect } from 'next/navigation'
import {
  parseCheckoutInterval,
  parseCheckoutPlan,
} from '@/lib/checkout'
import { redirectCheckoutSession } from '@/lib/checkout-server'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{
    plan?: string
    interval?: string
  }>
}

export default async function CheckoutPage({ searchParams }: PageProps) {
  const params = await searchParams
  const plan = parseCheckoutPlan(params.plan)

  if (!plan) {
    redirect('/billing')
  }

  const interval = parseCheckoutInterval(params.interval)
  await redirectCheckoutSession(plan, interval)

  redirect('/billing')
}
