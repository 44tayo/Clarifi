import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { cn } from '@/lib/utils'

type LandingSectionTone = 'default' | 'tint' | 'dark'

const toneClass: Record<LandingSectionTone, string> = {
  default: 'landing-section',
  tint: 'landing-section landing-section-tint',
  dark: 'landing-section landing-section-dark',
}

export type LandingSectionProps = ComponentPropsWithoutRef<'section'> & {
  tone?: LandingSectionTone
  children: ReactNode
}

export function LandingSection({
  tone = 'default',
  className,
  children,
  ...props
}: LandingSectionProps) {
  return (
    <section className={cn(toneClass[tone], className)} {...props}>
      {children}
    </section>
  )
}
