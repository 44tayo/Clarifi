'use client'

import { DownloadClarifi } from '@/components/DownloadClarifi'

type DownloadWithInstallModalProps = {
  variant?: 'dashboard' | 'compact'
  className?: string
  buttonStyle?: 'landing' | 'shadcn'
}

export function DownloadWithInstallModal(props: DownloadWithInstallModalProps) {
  return <DownloadClarifi {...props} />
}
