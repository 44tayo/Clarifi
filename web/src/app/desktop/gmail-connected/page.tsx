'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function DesktopGmailConnectedPage() {
  const [deepLinkAttempted, setDeepLinkAttempted] = useState(false)

  useEffect(() => {
    window.location.href = 'clarifi://gmail-connected?status=connected'
    setDeepLinkAttempted(true)
  }, [])

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4 px-8 text-center">
      <h1 className="text-2xl font-bold">Gmail connected</h1>
      <p className="text-white/70 text-sm max-w-md">
        Clarifi can now search and summarize your emails when you ask in chat.
      </p>
      {deepLinkAttempted ? (
        <p className="text-green-400 text-sm max-w-md">
          Return to Clarifi — your connection should update automatically.
        </p>
      ) : null}
      <Link href="/dashboard" className="text-sm text-white/40 hover:text-white mt-4">
        ← Back to dashboard
      </Link>
    </main>
  )
}
