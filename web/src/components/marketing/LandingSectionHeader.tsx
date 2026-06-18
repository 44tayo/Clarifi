import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type LandingSectionHeaderProps = {
  title: string
  subtitle?: string
  centered?: boolean
  className?: string
  children?: ReactNode
}

export function LandingSectionHeader({
  title,
  subtitle,
  centered = true,
  className,
  children,
}: LandingSectionHeaderProps) {
  return (
    <div
      className={cn('landing-section-header', centered && 'centered', className)}
      data-reveal
    >
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
      {children}
    </div>
  )
}
