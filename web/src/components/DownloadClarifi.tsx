'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
  type DownloadTarget,
  getDownloadForTarget,
  getDownloadManifest,
  getDownloadPageHref,
  parseDownloadTarget,
} from '@/lib/downloads'
import { platformDownloadLabel, useCustomerPlatform } from '@/hooks/useCustomerPlatform'
import { detectMacArchSync, type CustomerPlatform } from '@/lib/platform'
import { cn } from '@/lib/utils'

type DownloadClarifiProps = {
  variant?: 'dashboard' | 'compact'
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

export function defaultDownloadTarget(platform: CustomerPlatform): DownloadTarget {
  if (platform === 'windows') return 'windows'
  return detectMacArchSync() === 'x64' ? 'mac-x64' : 'mac-arm64'
}

export function triggerPlatformDownload(target: DownloadTarget): void {
  const { url, filename } = getDownloadForTarget(target)
  // #region agent log
  fetch('http://127.0.0.1:7545/ingest/c19994d6-505e-4d73-855e-70ee46048b6f', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '6989d7',
    },
    body: JSON.stringify({
      sessionId: '6989d7',
      runId: 'download-trigger',
      hypothesisId: 'H1',
      location: 'DownloadClarifi.tsx:triggerPlatformDownload',
      message: 'Triggering platform download',
      data: { target, url, filename },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener noreferrer'
  if (url.startsWith('/') || url.startsWith(window.location.origin)) {
    a.download = filename
  } else {
    a.target = '_blank'
  }
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export function DownloadClarifi({
  variant = 'dashboard',
  className,
  buttonStyle = 'shadcn',
}: DownloadClarifiProps) {
  const platform = useCustomerPlatform()
  const primary = defaultDownloadTarget(platform)
  const secondary: DownloadTarget = platform === 'mac' ? 'windows' : 'mac-arm64'

  const primaryManifest = getDownloadManifest(primary)
  const secondaryManifest = getDownloadManifest(secondary)
  const isPrimaryMac = primary.startsWith('mac')
  const isSecondaryMac = secondary.startsWith('mac')

  if (variant === 'compact') {
    if (buttonStyle === 'landing') {
      return (
        <Link href={primaryManifest.href} className={cn('download-mac-btn', className)}>
          {isPrimaryMac ? <AppleLogo size={14} /> : null}
          {platformDownloadLabel(platform)}
        </Link>
      )
    }

    return (
      <Button asChild className={cn('gap-2', className)}>
        <Link href={primaryManifest.href}>
          {isPrimaryMac ? <AppleLogo size={14} /> : null}
          {platformDownloadLabel(platform)}
        </Link>
      </Button>
    )
  }

  return (
    <div className={cn('flex flex-wrap gap-3', className)}>
      <Button asChild className="gap-2">
        <Link href={primaryManifest.href}>
          {isPrimaryMac ? <AppleLogo size={14} /> : null}
          {primaryManifest.shortLabel}
        </Link>
      </Button>
      <Button asChild variant="outline" className="gap-2">
        <Link href={secondaryManifest.href}>
          {isSecondaryMac ? <AppleLogo size={14} /> : null}
          {secondaryManifest.shortLabel}
        </Link>
      </Button>
    </div>
  )
}

export { parseDownloadTarget }
