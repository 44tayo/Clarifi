'use client'

import { useCallback } from 'react'

import { Button } from '@/components/ui/button'
import {
  MAC_DMG_FILENAME,
  WIN_EXE_FILENAME,
  getMacDownloadPath,
  getWindowsDownloadPath,
} from '@/lib/downloads'
import { platformDownloadLabel, useCustomerPlatform } from '@/hooks/useCustomerPlatform'
import { type CustomerPlatform } from '@/lib/platform'
import { cn } from '@/lib/utils'

type DownloadClarifiProps = {
  variant?: 'dashboard' | 'compact'
  onDownloaded?: (platform: CustomerPlatform) => void
  className?: string
  buttonStyle?: 'landing' | 'shadcn'
}

export function AppleLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  )
}

async function recordPlatform(platform: CustomerPlatform): Promise<void> {
  try {
    await fetch('/api/customer/platform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform }),
    })
  } catch {
    /* ignore — unauthenticated or offline */
  }
}

export function triggerPlatformDownload(platform: CustomerPlatform): void {
  const path = platform === 'windows' ? getWindowsDownloadPath() : getMacDownloadPath()
  const filename = platform === 'windows' ? WIN_EXE_FILENAME : MAC_DMG_FILENAME
  const a = document.createElement('a')
  a.href = path
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export function DownloadClarifi({
  variant = 'dashboard',
  onDownloaded,
  className,
}: DownloadClarifiProps) {
  const platform = useCustomerPlatform()
  const secondary: CustomerPlatform = platform === 'mac' ? 'windows' : 'mac'

  const download = useCallback(
    (targetPlatform: CustomerPlatform) => {
      triggerPlatformDownload(targetPlatform)
      void recordPlatform(targetPlatform)
      onDownloaded?.(targetPlatform)
    },
    [onDownloaded],
  )

  const label = platformDownloadLabel(platform)
  const secondaryLabel = platformDownloadLabel(secondary)
  const isMac = platform === 'mac'

  if (variant === 'compact') {
    return (
      <Button type="button" className={cn('gap-2', className)} onClick={() => download(platform)}>
        {isMac ? <AppleLogo size={14} /> : null}
        {label}
      </Button>
    )
  }

  return (
    <div className={cn('flex flex-wrap gap-3', className)}>
      <Button type="button" className="gap-2" onClick={() => download(platform)}>
        {isMac ? <AppleLogo size={14} /> : null}
        {label}
      </Button>
      <Button type="button" variant="outline" className="gap-2" onClick={() => download(secondary)}>
        {secondary === 'mac' ? <AppleLogo size={14} /> : null}
        {secondaryLabel}
      </Button>
    </div>
  )
}
