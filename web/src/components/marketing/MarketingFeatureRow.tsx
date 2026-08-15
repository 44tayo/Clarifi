import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type MarketingFeatureRowLayout = 'wide-narrow' | 'narrow-wide' | 'thirds'

type MarketingFeatureRowProps = {
  children: ReactNode
  layout: MarketingFeatureRowLayout
  className?: string
}

export function MarketingFeatureRow({ children, layout, className }: MarketingFeatureRowProps) {
  return (
    <div
      className={cn(
        'ds-feature-row',
        layout === 'wide-narrow' && 'ds-feature-row--wide-narrow',
        layout === 'narrow-wide' && 'ds-feature-row--narrow-wide',
        layout === 'thirds' && 'ds-feature-row--thirds',
        className,
      )}
    >
      {children}
    </div>
  )
}
