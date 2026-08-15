'use client'

import Link from 'next/link'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authNextCookieValue } from '@/lib/auth-next'
import { createClient } from '@/lib/supabase/client'
import { authCallbackUrl } from '@/lib/site-url'

type OAuthProvider = 'google' | 'azure'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden>
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f0" d="M1 12h10v10H1z" />
      <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  )
}

type AuthFormProps = {
  mode: 'sign-in' | 'sign-up'
  next?: string
  title?: string
  subtitle?: string
  alternateHref: string
  alternateLabel: string
  error?: string | null
}

const DEFAULT_TITLE = 'Never scramble for meeting notes again'

function rememberAuthNext(next: string) {
  document.cookie = authNextCookieValue(next)
}

export function AuthForm({
  mode,
  next = '/dashboard',
  title = DEFAULT_TITLE,
  subtitle,
  alternateHref,
  alternateLabel,
  error,
}: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'email_sent' | 'error'>('idle')
  const [message, setMessage] = useState(error ?? '')
  const [showEmail, setShowEmail] = useState(false)

  const resolvedSubtitle =
    subtitle ??
    (mode === 'sign-up'
      ? 'Create an account to pair Clarifi Desktop and unlock AI summaries.'
      : 'Sign in to access your dashboard and pair Clarifi Desktop.')

  const redirectTo = authCallbackUrl(next)

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return

    setStatus('loading')
    setMessage('')
    rememberAuthNext(next)

    const supabase = createClient()
    if (!supabase) {
      setStatus('error')
      setMessage('Sign-in is temporarily unavailable.')
      return
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
      },
    })

    if (otpError) {
      setStatus('error')
      setMessage(otpError.message)
      return
    }

    setStatus('email_sent')
    setMessage('Check your email for a magic link to continue.')
  }

  const handleOAuth = async (provider: OAuthProvider) => {
    setStatus('loading')
    setMessage('')
    rememberAuthNext(next)

    const supabase = createClient()
    if (!supabase) {
      setStatus('error')
      setMessage('Sign-in is temporarily unavailable.')
      return
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    })

    if (oauthError) {
      setStatus('error')
      setMessage(oauthError.message)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo">
          Clarifi
        </Link>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-subtitle">{resolvedSubtitle}</p>

        <div className="auth-oauth-stack">
          <button
            type="button"
            className="auth-oauth-btn"
            onClick={() => void handleOAuth('google')}
            disabled={status === 'loading'}
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <button
            type="button"
            className="auth-oauth-btn"
            onClick={() => void handleOAuth('azure')}
            disabled={status === 'loading'}
          >
            <MicrosoftIcon />
            Continue with Microsoft
          </button>
        </div>

        {!showEmail ? (
          <button type="button" className="auth-email-toggle" onClick={() => setShowEmail(true)}>
            Sign in with email or SSO instead
          </button>
        ) : (
          <form className="auth-form" onSubmit={(e) => void handleEmail(e)}>
            <div className="space-y-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="auth-input"
              />
            </div>
            <Button type="submit" className="w-full auth-email-submit" disabled={status === 'loading'}>
              {mode === 'sign-up' ? 'Create account' : 'Continue with email'}
            </Button>
          </form>
        )}

        <p className="auth-legal">
          By clicking continue, you agree to our <Link href="/terms">Terms of Service</Link> and{' '}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>

        {message ? (
          <p
            className={`auth-status ${status === 'error' || error ? 'error' : status === 'email_sent' ? 'success' : ''}`}
          >
            {message}
          </p>
        ) : null}

        <p className="auth-alt">
          <Link href={alternateHref}>{alternateLabel}</Link>
        </p>
      </div>
    </main>
  )
}
