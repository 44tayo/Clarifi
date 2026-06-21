import { Suspense } from 'react'

import { DownloadHelpPage } from '@/components/download/DownloadHelpPage'

export const metadata = {
  title: 'Download — Clarifi',
  description:
    'Download Clarifi for macOS (Apple Silicon or Intel) or Windows, with step-by-step install guidance.',
  alternates: { canonical: '/download' },
}

export default function Page() {
  return (
    <Suspense>
      <DownloadHelpPage />
    </Suspense>
  )
}
