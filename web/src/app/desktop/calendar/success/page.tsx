'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const PROVIDER_LABELS = {
  google: 'Google Calendar',
  microsoft: 'Microsoft Outlook',
} as const

export default function DesktopCalendarSuccessPage() {
  const searchParams = useSearchParams()
  const providerParam = searchParams.get('provider')
  const provider =
    providerParam === 'google' || providerParam === 'microsoft' ? providerParam : null

  return (
    <main className="min-h-screen bg-[#f4f4f5] px-6 py-16 text-[#1a1a2e]">
      <div className="mx-auto max-w-lg rounded-2xl border border-[#e8ecf4] bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-[#047857]">Connected</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Calendar linked</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#6b7280]">
          {provider
            ? `${PROVIDER_LABELS[provider]} is now connected to Clarifi.`
            : 'Your calendar is now connected to Clarifi.'}{' '}
          Upcoming meetings will appear in the desktop sidebar.
        </p>
        <p className="mt-6 text-sm text-[#6b7280]">
          You can close this tab and return to Clarifi. Events sync automatically every few
          minutes.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-semibold text-[#2b6cff]">
          Open dashboard
        </Link>
      </div>
    </main>
  )
}
