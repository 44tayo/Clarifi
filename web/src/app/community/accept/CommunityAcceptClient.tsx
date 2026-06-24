'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export default function CommunityAcceptClient() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'missing'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('missing')
      return
    }

    void (async () => {
      try {
        const response = await fetch('/api/communities/invites/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = (await response.json()) as { error?: string; communityId?: string }
        if (!response.ok) {
          setStatus('error')
          setMessage(data.error ?? 'accept_failed')
          return
        }
        setStatus('success')
        setMessage(data.communityId ?? '')
      } catch {
        setStatus('error')
        setMessage('network_error')
      }
    })()
  }, [token])

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4 px-8 text-center">
      <h1 className="text-2xl font-bold">Community invite</h1>
      {status === 'loading' ? (
        <p className="text-white/70 text-sm">Accepting your invite…</p>
      ) : null}
      {status === 'missing' ? (
        <p className="text-white/70 text-sm">This invite link is missing a token.</p>
      ) : null}
      {status === 'success' ? (
        <p className="text-green-400 text-sm max-w-md">
          You&apos;re in. Open Clarifi Settings → Community to view shared content.
        </p>
      ) : null}
      {status === 'error' ? (
        <p className="text-red-400 text-sm max-w-md">
          {message === 'invite_requires_pro_plus' || message === 'plan_required'
            ? 'Communities require a Pro+ subscription. Upgrade your plan, then open this link again.'
            : message === 'email_mismatch'
              ? 'Sign in with the email address that received this invite.'
              : `Could not accept invite (${message}).`}
        </p>
      ) : null}
      <Link href="/dashboard" className="text-sm text-white/40 hover:text-white mt-4">
        ← Back to dashboard
      </Link>
    </main>
  )
}
