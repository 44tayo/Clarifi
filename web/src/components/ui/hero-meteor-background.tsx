'use client'

import './hero-meteor-background.css'

import { cn } from '@/lib/utils'

export function HeroMeteorBackground({ className }: { className?: string }) {
  return (
    <div className={cn('hero-meteor-bg', className)} aria-hidden>
      <div className="hero-sky-photo" />
      <div className="hero-gradient-up" />
      <div className="hero-gradient-down" />
    </div>
  )
}
