import type { ReactNode } from 'react'

import type { MarketingFeatureVariant } from '@/lib/design-tokens'
import { cn } from '@/lib/utils'

import { MarketingFeatureVisual } from './MarketingFeatureVisual'

const variantClass: Record<MarketingFeatureVariant, string> = {
  wide: 'ds-feature-wide',
  narrow: 'ds-feature-narrow',
  third: 'ds-feature-third',
}

export type MarketingFeatureCardProps = {
  title: string
  description: string
  variant?: MarketingFeatureVariant
  visual: ReactNode
  className?: string
}

export function MarketingFeatureCard({
  title,
  description,
  variant = 'third',
  visual,
  className,
}: MarketingFeatureCardProps) {
  return (
    <article className={cn('ds-feature-card', variantClass[variant], className)} data-reveal>
      <MarketingFeatureVisual>{visual}</MarketingFeatureVisual>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  )
}
