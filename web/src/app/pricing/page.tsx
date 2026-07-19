import { Suspense } from 'react'
import { PricingPage } from '@/components/pricing/PricingPage'

export const metadata = {
  title: 'Pricing — Clarifi',
  description:
    'Free forever with unlimited meetings and 30 days of note history. Upgrade to Pro ($19/mo) or Pro+ ($39/seat/mo) for unlimited history and team features.',
  alternates: { canonical: '/pricing' },
}

export default function Page() {
  return (
    <Suspense>
      <PricingPage />
    </Suspense>
  )
}
