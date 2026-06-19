'use client'

import Link from 'next/link'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authNextCookieValue } from '@/lib/auth-next'
import { createClient } from '@/lib/supabase/client'
import { authCallbackUrl } from '@/lib/site-url'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
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

type AuthFormProps = {
  mode: 'sign-in' | 'sign-up'
  next?: string
  title: string
  subtitle: string
  alternateHref: string
  alternateLabel: string
  error?: string | null
}

function rememberAuthNext(next: string) {
  document.cookie = authNextCookieValue(next)
}

export function AuthForm({
  mode,
  next = '/dashboard',
  title,
  subtitle,
  alternateHref,
  alternateLabel,
  error,
}: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'email_sent' | 'error'>('idle')
  const [message, setMessage] = useState(error ?? '')

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

  const handleGoogle = async () => {
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
      provider: 'google',
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
        <p className="auth-subtitle">{subtitle}</p>

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
            />
          </div>
          <Button type="submit" className="w-full" disabled={status === 'loading'}>
            {mode === 'sign-up' ? 'Create account' : 'Continue with email'}
          </Button>
        </form>

        <div className="auth-divider">
          <span>Or</span>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => void handleGoogle()}
          disabled={status === 'loading'}
        >
          <GoogleIcon />
          Continue with Google
        </Button>

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
