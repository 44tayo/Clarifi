import type { Metadata } from 'next'
import { Suspense } from 'react'
import { MarketingHomePage } from '@/components/landing/MarketingHomePage'
import { redirectOAuthCodeIfPresent } from '@/lib/prelaunch-page'
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OG_IMAGE,
  SITE_TITLE,
} from '@/lib/site-metadata'

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: '/',
    siteName: SITE_NAME,
    images: [SITE_OG_IMAGE],
  },
  twitter: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE.url],
  },
}

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams
  await redirectOAuthCodeIfPresent(params)

  return (
    <Suspense fallback={null}>
      <MarketingHomePage />
    </Suspense>
  )
}
