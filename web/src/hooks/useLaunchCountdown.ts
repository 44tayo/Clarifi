'use client'

import { useEffect, useState } from 'react'
import { LAUNCH_PREVIEW_COOKIE, resolveLaunchPreviewState } from '@/lib/launch-preview'
import { getLaunchCountdown } from '@/lib/waitlist-config'

function readPreviewCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${LAUNCH_PREVIEW_COOKIE}=`))
  return match?.split('=')[1] ?? null
}

function readPreviewQuery(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('preview')
}

export function useLaunchCountdown() {
  const [previewLive, setPreviewLive] = useState(false)
  const [forceWaitlist, setForceWaitlist] = useState(false)
  const [countdown, setCountdown] = useState<ReturnType<typeof getLaunchCountdown> | null>(null)

  useEffect(() => {
    const syncPreview = () => {
      const state = resolveLaunchPreviewState(
        { preview: readPreviewQuery() },
        readPreviewCookie(),
      )
      setPreviewLive(state.previewLive)
      setForceWaitlist(state.forceWaitlist)
    }

    syncPreview()
    const onPopState = () => syncPreview()
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    const tick = () => setCountdown(getLaunchCountdown(Date.now(), previewLive, forceWaitlist))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [previewLive, forceWaitlist])

  return countdown
}
