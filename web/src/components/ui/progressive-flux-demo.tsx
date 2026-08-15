'use client'

import * as React from 'react'

import { ProgressiveFluxLoader } from '@/components/ui/progressive-flux-loader'

const PHASES = [
  { at: 0, label: 'uploading' },
  { at: 40, label: 'processing' },
  { at: 75, label: 'finalizing' },
  { at: 100, label: 'complete' },
]

/** Standalone demo — simulated upload progress for previews. */
export function ProgressiveFluxDemo() {
  const [progress, setProgress] = React.useState(0)

  React.useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => (p >= 100 ? 0 : Math.min(100, p + 2)))
    }, 200)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex min-h-[420px] w-full items-center justify-center px-6 py-16">
      <ProgressiveFluxLoader value={progress} phases={PHASES} />
    </div>
  )
}
