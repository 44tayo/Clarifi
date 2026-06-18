'use client'

import { useEffect, useState } from 'react'

import {
  ProgressiveFluxLoader,
  type ProgressiveFluxPhase,
} from '@/components/ui/progressive-flux-loader'

export const DESKTOP_CONNECT_PHASES: ProgressiveFluxPhase[] = [
  { at: 0, label: 'checking account' },
  { at: 35, label: 'preparing connection' },
  { at: 70, label: 'opening clarifi' },
  { at: 100, label: 'connected' },
]

export function useSimulatedProgress(active: boolean, complete: boolean, cap = 92) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (complete) {
      setProgress(100)
      return
    }
    if (!active) {
      setProgress(0)
      return
    }

    const id = window.setInterval(() => {
      setProgress((p) => (p >= cap ? p : Math.min(cap, p + 3)))
    }, 140)

    return () => window.clearInterval(id)
  }, [active, complete, cap])

  return progress
}

type ConnectFluxLoaderProps = {
  progress: number
  className?: string
  textClassName?: string
}

export function ConnectFluxLoader({
  progress,
  className,
  textClassName,
}: ConnectFluxLoaderProps) {
  return (
    <ProgressiveFluxLoader
      value={progress}
      phases={DESKTOP_CONNECT_PHASES}
      loop={false}
      className={className}
      textClassName={textClassName}
    />
  )
}
