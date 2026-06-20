'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { ClarifiBentoSection } from '@/components/landing/ClarifiBentoSection'
import { FaqSection } from '@/components/landing/FaqSection'
import { HeroScrollSection } from '@/components/landing/HeroScrollSection'
import { DownloadWithInstallModal } from '@/components/DownloadWithInstallModal'
import { useLaunchCountdown } from '@/hooks/useLaunchCountdown'
import { createClient } from '@/lib/supabase/client'
import type { SupabasePublicConfig } from '@/lib/supabase/env'
import { WAITLIST_LAUNCH_AT } from '@/lib/waitlist-config'
import { joinWaitlist } from '@/lib/waitlist'
import { fireWaitlistConfetti } from '@/lib/waitlist-confetti'
import { authCallbackUrl } from '@/lib/site-url'
import '@/components/landing/landing.css'
import './waitlist.css'
import { WaitlistModelsSection } from './WaitlistModelsSection'
import { WaitlistProductSections, WaitlistSiteFooter } from './WaitlistPageSections'

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

function pad(n: number) {
  return String(n).padStart(2, '0')
}

const LAUNCH_LABEL = WAITLIST_LAUNCH_AT.toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

function JoinWaitlistButton({
  onClick,
  className = '',
  large = false,
}: {
  onClick: () => void
  className?: string
  large?: boolean
}) {
  return (
    <button
      type="button"
      className={`landing-cta ${className} ${large ? 'landing-cta-large' : ''}`}
      onClick={onClick}
    >
      Join the waitlist
    </button>
  )
}

type WaitlistPageProps = {
  supabaseConfig: SupabasePublicConfig | null
  siteOrigin?: string
}

export function WaitlistPage({ supabaseConfig, siteOrigin }: WaitlistPageProps) {
  const oauthRedirectTo = authCallbackUrl('/', siteOrigin)
  const router = useRouter()
  const [activeConfig, setActiveConfig] = useState<SupabasePublicConfig | null>(supabaseConfig)
  const [configChecked, setConfigChecked] = useState(supabaseConfig !== null)
  const signupEnabled = activeConfig !== null
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const countdown = useLaunchCountdown()
  const isLive = countdown?.isLive ?? false
  const [status, setStatus] = useState<'idle' | 'loading' | 'email_sent' | 'joined' | 'error'>(
    'idle',
  )
  const [message, setMessage] = useState('')
  const scrollToJoin = useCallback(() => {
    document.getElementById('join')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (!configChecked) return

    if (searchParams.get('error') === 'config' && signupEnabled) {
      router.replace('/')
      setStatus('idle')
      setMessage('')
    }
  }, [configChecked, signupEnabled, searchParams, router])

  useEffect(() => {
    if (status !== 'joined') return
    void fireWaitlistConfetti()
  }, [status])

  useEffect(() => {
    if (activeConfig) {
      setConfigChecked(true)
      return
    }
    void fetch('/api/waitlist/config')
      .then((r) => r.json())
      .then((d: { enabled?: boolean; url?: string; key?: string }) => {
        if (d.enabled && d.url && d.key) {
          setActiveConfig({ url: d.url, key: d.key })
        }
      })
      .catch(() => undefined)
      .finally(() => setConfigChecked(true))
  }, [activeConfig])

  const completeJoin = useCallback(async () => {
    const supabase = createClient(activeConfig)
    if (!supabase) return
    const result = await joinWaitlist(supabase)
    if (result.ok) {
      setStatus('joined')
      setMessage("You're on the list. We'll email you when Clarifi launches.")
    } else {
      setStatus('error')
      setMessage('Something went wrong. Please try again.')
    }
  }, [activeConfig])

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      setStatus('joined')
      setMessage('Payment received — thanks for subscribing. Sign in to link your plan to your account.')
      scrollToJoin()
      return
    }
    if (searchParams.get('joined') === '1') {
      setStatus('joined')
      setMessage("You're on the list. We'll email you when Clarifi launches.")
      scrollToJoin()
      return
    }
    if (searchParams.get('error') === 'auth') {
      setStatus('error')
      setMessage('Sign-in failed. Please try again.')
      scrollToJoin()
      return
    }
    if (searchParams.get('error') === 'config') {
      if (!configChecked || signupEnabled) return
      setStatus('error')
      setMessage('Waitlist sign-up is temporarily unavailable. Please try again later.')
      scrollToJoin()
      return
    }
    if (searchParams.get('error') === 'waitlist') {
      setStatus('error')
      setMessage('You signed in, but we could not add you to the waitlist. Please try again.')
      scrollToJoin()
      return
    }

    if (!signupEnabled || isLive) return

    const supabase = createClient(activeConfig)
    if (!supabase) return
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        void completeJoin()
      }
    })
  }, [searchParams, completeJoin, scrollToJoin, signupEnabled, activeConfig, configChecked, isLive])

  const handleEmailJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return

    setStatus('loading')
    setMessage('')

    const supabase = createClient(activeConfig)
    if (!supabase) {
      setStatus('error')
      setMessage('Waitlist sign-up is temporarily unavailable. Please try again later.')
      return
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: oauthRedirectTo,
        shouldCreateUser: true,
      },
    })

    if (error) {
      setStatus('error')
      setMessage(error.message)
      return
    }

    setStatus('email_sent')
    setMessage(`Check your inbox — we sent a link to ${trimmed}.`)
  }

  const handleGoogleJoin = async () => {
    setStatus('loading')
    setMessage('')

    const supabase = createClient(activeConfig)
    if (!supabase) {
      setStatus('error')
      setMessage('Waitlist sign-up is temporarily unavailable. Please try again later.')
      return
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: oauthRedirectTo,
      },
    })

    if (error) {
      setStatus('error')
      setMessage(error.message)
    }
  }

  return (
    <div className="landing-root waitlist-page">
      <HeroScrollSection isLive={isLive} onJoin={scrollToJoin} />

      <ClarifiBentoSection />

      <WaitlistModelsSection />

      <WaitlistProductSections />

      <section className="waitlist-join" id="join" data-reveal>
        <div className="waitlist-join-inner">
          <p className="waitlist-eyebrow">{isLive ? 'Available now' : 'Launching soon'}</p>

          {isLive ? (
            <>
              <h2 className="waitlist-title">Download Clarifi</h2>
              <p className="waitlist-sub">
                Install for your platform, then sign in on the web to connect your account.
              </p>
              <DownloadWithInstallModal variant="compact" className="waitlist-download-cta" />
            </>
          ) : (
            <>
              <div className="waitlist-countdown" aria-live="polite">
                {(
                  countdown
                    ? ([
                        ['days', countdown.days],
                        ['hours', countdown.hours],
                        ['minutes', countdown.minutes],
                        ['seconds', countdown.seconds],
                      ] as const)
                    : ([
                        ['days', 0],
                        ['hours', 0],
                        ['minutes', 0],
                        ['seconds', 0],
                      ] as const)
                ).map(([label, value]) => (
                  <div key={label} className="waitlist-unit">
                    <span className="waitlist-unit-value" suppressHydrationWarning>
                      {countdown ? pad(value) : '--'}
                    </span>
                    <span className="waitlist-unit-label">{label}</span>
                  </div>
                ))}
              </div>
              <p className="waitlist-launch-date">
                Launching <strong>{LAUNCH_LABEL}</strong>
              </p>

              {!configChecked && (
                <p className="waitlist-status info">Loading sign-up…</p>
              )}

              {configChecked && !signupEnabled && (
                <p className="waitlist-status info">
                  Waitlist sign-up is temporarily unavailable. Please try again later.
                </p>
              )}

              {signupEnabled && status !== 'joined' && status !== 'email_sent' && (
                <div className="waitlist-form">
                  <form className="waitlist-email-row" onSubmit={(e) => void handleEmailJoin(e)}>
                    <input
                      type="email"
                      className="waitlist-input"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      disabled={status === 'loading'}
                    />
                    <button
                      type="submit"
                      className="waitlist-btn waitlist-btn-primary"
                      disabled={status === 'loading'}
                    >
                      Join the waitlist
                    </button>
                  </form>

                  <div className="waitlist-divider">or</div>

                  <button
                    type="button"
                    className="waitlist-btn waitlist-btn-google"
                    onClick={() => void handleGoogleJoin()}
                    disabled={status === 'loading'}
                  >
                    <GoogleIcon />
                    Continue with Google
                  </button>
                </div>
              )}
            </>
          )}

          {message && !(searchParams.get('error') === 'config' && signupEnabled) && (
            <p
              className={`waitlist-status ${
                status === 'error' ? 'error' : status === 'email_sent' ? 'info' : 'success'
              }`}
            >
              {message}
            </p>
          )}

          <p className="waitlist-footer">
            Questions?{' '}
            <a href="mailto:tayowilliams23@gmail.com">tayowilliams23@gmail.com</a>
          </p>
        </div>
      </section>

      <FaqSection className="waitlist-faq" />

      <WaitlistSiteFooter />
    </div>
  )
}
