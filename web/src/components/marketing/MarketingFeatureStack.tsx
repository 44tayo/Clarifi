import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type MarketingFeatureStackProps = {
  children: ReactNode
  className?: string
}

export function MarketingFeatureStack({ children, className }: MarketingFeatureStackProps) {
  return <div className={cn('ds-feature-stack', className)}>{children}</div>
}
