import { redirect } from 'next/navigation'

import { getDownloadForTarget, parseDownloadTarget } from '@/lib/downloads'

export const metadata = {
  title: 'Download — Clarifi',
  description: 'Download Clarifi for macOS or Windows.',
  alternates: { canonical: '/download' },
}

type PageProps = {
  searchParams?: Promise<{ platform?: string; arch?: string }>
}

/** Legacy /download bookmarks redirect straight to the GitHub installer. */
export default async function Page({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {}
  const target = parseDownloadTarget(params.platform, params.arch)
  redirect(getDownloadForTarget(target).url)
}
