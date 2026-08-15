'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { AuthForm } from '@/components/auth/AuthForm'
import { authNextCookieValue } from '@/lib/auth-next'
import { createClient } from '@/lib/supabase/client'
import { authCallbackUrl } from '@/lib/site-url'
import '@/components/auth/auth.css'

const PROVIDERS = new Set(['google', 'azure'])

export function DesktopAuthClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const provider = searchParams.get('provider')
  const next = searchParams.get('next') || '/desktop/connect'
  const [error, setError] = useState<string | null>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (!provider || !PROVIDERS.has(provider) || started) return

    setStarted(true)
    document.cookie = authNextCookieValue(next)

    const supabase = createClient()
    if (!supabase) {
      setError('Sign-in is temporarily unavailable.')
      return
    }

    void supabase.auth
      .signInWithOAuth({
        provider: provider as 'google' | 'azure',
        options: { redirectTo: authCallbackUrl(next) },
      })
      .then(({ error: oauthError }) => {
        if (oauthError) {
          setError(oauthError.message)
        }
      })
  }, [provider, next, started])

  if (!provider || !PROVIDERS.has(provider)) {
    return (
      <AuthForm
        mode="sign-in"
        next={next}
        subtitle="Sign in to pair Clarifi Desktop with your account."
        alternateHref="/desktop/sign-up"
        alternateLabel="Need an account? Sign up"
      />
    )
  }

  if (error) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <p className="auth-status error">{error}</p>
          <button
            type="button"
            className="auth-email-toggle"
            onClick={() => router.push('/desktop/sign-in')}
          >
            Try another sign-in method
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="auth-subtitle">Redirecting to sign in…</p>
      </div>
    </main>
  )
}
