'use client'

import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DownloadClarifi, triggerPlatformDownload } from '@/components/DownloadClarifi'
import { InstallModal } from '@/components/landing/InstallModal'
import { useCustomerPlatform } from '@/hooks/useCustomerPlatform'
import type { CustomerPlatform } from '@/lib/platform'

type DownloadWithInstallModalProps = {
  variant?: 'dashboard' | 'compact'
  className?: string
  buttonStyle?: 'landing' | 'shadcn'
}

export function DownloadWithInstallModal({
  variant = 'compact',
  className,
  buttonStyle = 'shadcn',
}: DownloadWithInstallModalProps) {
  const [installOpen, setInstallOpen] = useState(false)
  const platform = useCustomerPlatform()

  const handleDownloaded = useCallback((downloadedPlatform: CustomerPlatform) => {
    if (downloadedPlatform === 'mac') {
      setInstallOpen(true)
    }
  }, [])

  const handleDownloadAgain = useCallback(() => {
    triggerPlatformDownload(platform)
  }, [platform])

  return (
    <>
      <DownloadClarifi
        variant={variant}
        className={className}
        buttonStyle={buttonStyle}
        onDownloaded={handleDownloaded}
      />
      <InstallModal
        open={installOpen}
        onClose={() => setInstallOpen(false)}
        onDownloadAgain={handleDownloadAgain}
      />
    </>
  )
}
