import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type MarketingFeatureVisualProps = {
  children: ReactNode
  className?: string
}

export function MarketingFeatureVisual({ children, className }: MarketingFeatureVisualProps) {
  return <div className={cn('ds-feature-visual', className)}>{children}</div>
}
