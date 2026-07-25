'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const PROVIDER_LABELS = {
  google: 'Google Calendar',
  microsoft: 'Microsoft Outlook',
} as const

function DesktopCalendarConnectContent() {
  const searchParams = useSearchParams()
  const providerParam = searchParams.get('provider')
  const provider =
    providerParam === 'google' || providerParam === 'microsoft' ? providerParam : null
  const error = searchParams.get('error')

  return (
    <main className="min-h-screen bg-[#f4f4f5] px-6 py-16 text-[#1a1a2e]">
      <div className="mx-auto max-w-lg rounded-2xl border border-[#e8ecf4] bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-[#6b7280]">Clarifi desktop</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Connect your calendar</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#6b7280]">
          Sync upcoming meetings so Clarifi can pre-fill titles, show a &ldquo;Coming up&rdquo; list,
          and match speakers to invitees and your contacts (Gmail / Outlook).
        </p>

        {error ? (
          <p className="mt-4 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
            Calendar connection failed ({error.replace(/_/g, ' ')}). Try again below.
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          <a
            href="/api/calendar/connect?provider=google"
            className="inline-flex items-center justify-center rounded-xl border border-[#e8ecf4] bg-white px-4 py-3 text-sm font-semibold text-[#1a1a2e] hover:bg-[#f8fafc]"
          >
            Connect Google Calendar
          </a>
          <a
            href="/api/calendar/connect?provider=microsoft"
            className="inline-flex items-center justify-center rounded-xl border border-[#e8ecf4] bg-white px-4 py-3 text-sm font-semibold text-[#1a1a2e] hover:bg-[#f8fafc]"
          >
            Connect Microsoft Outlook
          </a>
        </div>

        {provider ? (
          <p className="mt-4 text-sm text-[#6b7280]">
            Selected: {PROVIDER_LABELS[provider]}. Sign in above if prompted, then authorize
            calendar and contacts access.
          </p>
        ) : null}

        <p className="mt-6 text-sm text-[#6b7280]">
          Return to the Clarifi desktop app when finished. You can close this tab.
        </p>

        <Link href="/dashboard" className="mt-4 inline-block text-sm font-semibold text-[#2b6cff]">
          Open dashboard
        </Link>
      </div>
    </main>
  )
}

export default function DesktopCalendarConnectPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f4f4f5]" />}>
      <DesktopCalendarConnectContent />
    </Suspense>
  )
}
