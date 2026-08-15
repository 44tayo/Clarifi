'use client'

import { DownloadClarifi } from '@/components/DownloadClarifi'

type DownloadWithInstallModalProps = {
  variant?: 'dashboard' | 'compact'
  className?: string
  buttonStyle?: 'landing' | 'shadcn'
}

/** @deprecated Name kept for call sites — downloads go straight to the installer. */
export function DownloadWithInstallModal(props: DownloadWithInstallModalProps) {
  return <DownloadClarifi {...props} />
}
