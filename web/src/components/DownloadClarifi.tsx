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
    // eslint-disable-next-line @next/next/no-img-element -- small inline brand mark
    <img
      src="/apple-logo.png"
      alt=""
      width={size}
      height={size}
      aria-hidden
      style={{ display: 'block', width: size, height: size, flexShrink: 0 }}
    />
  )
}

export function defaultDownloadTarget(platform: CustomerPlatform): DownloadTarget {
  if (platform === 'windows') return 'windows'
  return detectMacArchSync() === 'x64' ? 'mac-x64' : 'mac-arm64'
}

export function triggerPlatformDownload(target: DownloadTarget): void {
  const { url, filename } = getDownloadForTarget(target)
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
