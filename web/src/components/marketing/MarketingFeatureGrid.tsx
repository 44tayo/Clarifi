import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type MarketingFeatureGridProps = {
  children: ReactNode
  className?: string
}

export function MarketingFeatureGrid({ children, className }: MarketingFeatureGridProps) {
  return <div className={cn('ds-feature-grid', className)}>{children}</div>
}
