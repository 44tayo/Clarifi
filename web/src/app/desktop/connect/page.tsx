'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  ConnectFluxLoader,
  useSimulatedProgress,
} from '@/components/ui/connect-flux-loader'
import '@/components/auth/auth.css'

export default function DesktopConnectPage() {
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'opened' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const isConnecting = !ready || status === 'loading'
  const isComplete = status === 'opened'
  const progress = useSimulatedProgress(isConnecting || isComplete, isComplete)

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) {
      setReady(true)
      return
    }
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setSignedIn(!!session?.user)
      setReady(true)
    })
  }, [])

  useEffect(() => {
    if (!ready || !signedIn || status !== 'idle') return

    async function authorize() {
      setStatus('loading')
      setError(null)

      try {
        const res = await fetch('/api/desktop/authorize', { method: 'POST' })
        const data = await res.json()
        if (!res.ok || !data.deepLink) {
          setStatus('error')
          setError(data.error || 'Could not connect desktop')
          return
        }

        window.location.href = data.deepLink
        setStatus('opened')
      } catch {
        setStatus('error')
        setError('Network error — try again')
      }
    }

    void authorize()
  }, [ready, signedIn, status])

  if (!ready) {
    return (
      <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-8">
        <ConnectFluxLoader
          progress={progress}
          className="max-w-sm"
          textClassName="text-white/70 text-2xl sm:text-3xl"
        />
      </main>
    )
  }

  if (!signedIn) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <Link href="/" className="auth-logo">
            Clarifi
          </Link>
          <h1 className="auth-title">Never scramble for meeting notes again</h1>
          <p className="auth-subtitle">Sign in to pair Clarifi Desktop with your account.</p>
          <Link href="/desktop/sign-in" className="auth-oauth-btn" style={{ textDecoration: 'none' }}>
            Continue to sign in
          </Link>
          <p className="auth-alt" style={{ marginTop: '1rem' }}>
            <Link href="/desktop/sign-up">Need an account? Sign up</Link>
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6 px-8 text-center">
      <h1 className="text-2xl font-bold">Connecting Clarifi Desktop</h1>
      {(status === 'loading' || status === 'opened') && (
        <ConnectFluxLoader
          progress={progress}
          className="max-w-sm"
          textClassName="text-white/70 text-2xl sm:text-3xl"
        />
      )}
      {status === 'opened' && (
        <p className="text-green-400 text-sm max-w-md">
          Clarifi should open automatically. Return to the desktop app to start using it.
        </p>
      )}
      {status === 'error' && (
        <>
          <p className="text-red-400 text-sm">{error}</p>
          <button
            type="button"
            onClick={() => setStatus('idle')}
            className="bg-white text-black px-6 py-2 rounded-lg text-sm font-medium hover:bg-white/90"
          >
            Try again
          </button>
        </>
      )}
      <Link href="/dashboard" className="text-sm text-white/40 hover:text-white mt-4">
        ← Back to dashboard
      </Link>
    </main>
  )
}
