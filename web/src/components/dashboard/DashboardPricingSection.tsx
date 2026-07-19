'use client'

import { ArrowRight } from 'lucide-react'
import { useMemo } from 'react'

import { Pricing2, type PricingPlan } from '@/components/ui/pricing2'
import { PricingCheckoutButton } from '@/components/pricing/PricingCheckoutButton'
import { getPricingPlans } from '@/lib/pricing'
import type { PricingPlanId } from '@/lib/pricing'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function DashboardPricingSection() {
  const monthlyPlans = useMemo(() => getPricingPlans('monthly'), [])
  const annualPlans = useMemo(() => getPricingPlans('annual'), [])

  const plans: PricingPlan[] = monthlyPlans
    .filter((plan) => plan.id !== 'free')
    .map((plan, index) => {
      const annual = annualPlans.filter((p) => p.id !== 'free')[index]
      return {
        id: plan.id,
        name: plan.name,
        description: plan.tagline,
        monthlyPrice: plan.price,
        yearlyPrice: annual?.price ?? plan.price,
        features: plan.features.map((text) => ({ text })),
        button: {
          text: plan.cta,
          url: '/pricing',
        },
        renderCta: ({ isYearly }) => (
          <PricingCheckoutButton
            planId={plan.id as PricingPlanId}
            interval={isYearly ? 'annual' : 'monthly'}
            className={cn(buttonVariants({ variant: 'default' }), 'w-full gap-2')}
          >
            {plan.cta}
            <ArrowRight className="size-4" />
          </PricingCheckoutButton>
        ),
      }
    })

  return (
    <Pricing2
      compact
      className="mt-8"
      heading="Upgrade your plan"
      description="You're on the free plan with 30 days of note history. Upgrade to Pro or Pro+ for unlimited history."
      plans={plans}
    />
  )
}
