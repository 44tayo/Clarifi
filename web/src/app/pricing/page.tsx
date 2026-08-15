import { Suspense } from 'react'
import { PricingPage } from '@/components/pricing/PricingPage'

export const metadata = {
  title: 'Pricing — Clarifi',
  description:
    'Pro and Pro+ both include a 30-day free trial. Then $19/mo for Pro or $39/seat/mo for Pro+ — cancel anytime before the trial ends.',
  alternates: { canonical: '/pricing' },
}

export default function Page() {
  return (
    <Suspense>
      <PricingPage />
    </Suspense>
  )
}
