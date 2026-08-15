import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { cn } from '@/lib/utils'

type MarketingFeatureMockProps = ComponentPropsWithoutRef<'div'> & {
  children: ReactNode
  layout?: 'default' | 'summary' | 'chat' | 'notes' | 'share'
}

const layoutClass = {
  default: 'ds-mock',
  summary: 'ds-mock ds-mock-summary',
  chat: 'ds-mock ds-mock-chat',
  notes: 'ds-mock ds-mock-notes',
  share: 'ds-mock ds-mock-share',
} as const

export function MarketingFeatureMock({
  children,
  layout = 'default',
  className,
  ...props
}: MarketingFeatureMockProps) {
  return (
    <div className={cn(layoutClass[layout], className)} {...props}>
      {children}
    </div>
  )
}
