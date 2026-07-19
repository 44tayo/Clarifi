'use client'

import { useCallback, useEffect, useState } from 'react'

type OnboardingStep = 'welcome' | 'connect' | 'permissions'

type PermissionStatus = {
  microphone: string
  systemAudio: string
  platform: string
}

type AuthProvider = 'google' | 'azure' | 'email'

type OnboardingFlowProps = {
  paired: boolean
  onSignIn: (provider: AuthProvider) => void
  onComplete: () => void
}

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

export function OnboardingFlow({ paired, onSignIn, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<OnboardingStep>('welcome')
  const [perms, setPerms] = useState<PermissionStatus | null>(null)
  const [micBusy, setMicBusy] = useState(false)
  const [awaitingBrowser, setAwaitingBrowser] = useState(false)

  const refreshPerms = useCallback(async () => {
    const status = (await window.electronAPI.invoke('permissions:status')) as PermissionStatus
    setPerms(status)
  }, [])

  useEffect(() => {
    void refreshPerms()
  }, [refreshPerms])

  useEffect(() => {
    if (step === 'connect' && paired) {
      setAwaitingBrowser(false)
      setStep('permissions')
      void window.electronAPI.invoke('onboarding:save', { welcomeSeen: true })
    }
  }, [paired, step])

  const enableMic = useCallback(async () => {
    setMicBusy(true)
    try {
      await window.electronAPI.invoke('permissions:request-microphone')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((t) => t.stop())
      } catch {
        // OS dialog may have been denied — status refresh still reflects that.
      }
      await refreshPerms()
    } finally {
      setMicBusy(false)
    }
  }, [refreshPerms])

  const openSystemAudio = useCallback(async () => {
    await window.electronAPI.invoke('permissions:open-system-audio-settings')
    await refreshPerms()
  }, [refreshPerms])

  const finish = useCallback(async () => {
    await window.electronAPI.invoke('onboarding:complete')
    onComplete()
  }, [onComplete])

  const startSignIn = useCallback(
    (provider: AuthProvider) => {
      setAwaitingBrowser(true)
      onSignIn(provider)
    },
    [onSignIn],
  )

  const micGranted = perms?.microphone === 'granted'
  const systemGranted =
    perms?.systemAudio === 'granted' ||
    perms?.systemAudio === 'unsupported' ||
    perms?.platform !== 'darwin'
  const canContinue = micGranted

  return (
    <div className="onboarding-root">
      <div className={`onboarding-card ${step === 'connect' ? 'onboarding-card-auth' : ''}`}>
        <div className="onboarding-mark" aria-hidden="true">
          C
        </div>

        {step === 'welcome' ? (
          <>
            <h1>Welcome to Clarifi</h1>
            <p className="onboarding-sub">
              Your AI notepad for back-to-back meetings. Take light notes while Clarifi listens —
              hang up and get a clean summary, decisions, and action items. No bot joins the call.
            </p>
            <button
              type="button"
              className="btn btn-primary onboarding-cta"
              onClick={() => {
                setStep('connect')
                void window.electronAPI.invoke('onboarding:save', { welcomeSeen: true })
              }}
            >
              Get started
            </button>
          </>
        ) : null}

        {step === 'connect' ? (
          <>
            <h1>Never scramble for meeting notes again</h1>
            <p className="onboarding-sub">
              Sign up or log in to unlock AI summaries after every call. Works with any email —
              personal or work.
            </p>

            {paired ? (
              <p className="onboarding-status is-ok">Connected. Continuing…</p>
            ) : (
              <>
                <div className="onboarding-auth-stack">
                  <button
                    type="button"
                    className="onboarding-auth-btn"
                    onClick={() => startSignIn('google')}
                  >
                    <GoogleIcon />
                    Continue with Google
                  </button>
                  <button
                    type="button"
                    className="onboarding-auth-btn"
                    onClick={() => startSignIn('azure')}
                  >
                    <MicrosoftIcon />
                    Continue with Microsoft
                  </button>
                </div>

                <button
                  type="button"
                  className="link-btn onboarding-email-link"
                  onClick={() => startSignIn('email')}
                >
                  Sign in with email or SSO instead
                </button>

                {awaitingBrowser ? (
                  <p className="onboarding-status onboarding-waiting">
                    Complete sign-in in your browser. This window will continue automatically.
                  </p>
                ) : null}

                <p className="onboarding-legal">
                  By clicking continue, you agree to our{' '}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => void window.electronAPI.invoke('auth:open-legal', 'terms')}
                  >
                    Terms of Service
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => void window.electronAPI.invoke('auth:open-legal', 'privacy')}
                  >
                    Privacy Policy
                  </button>
                  .
                </p>
              </>
            )}

            <button
              type="button"
              className="link-btn onboarding-skip"
              onClick={() => setStep('permissions')}
            >
              Skip for now — local notes only
            </button>
          </>
        ) : null}

        {step === 'permissions' ? (
          <>
            <h1>Allow Clarifi to transcribe your meetings</h1>
            <p className="onboarding-sub">
              Clarifi transcribes with the sound on your laptop. No third-party bots join your
              meeting.
            </p>

            <div className="onboarding-perm-list">
              <div className="onboarding-perm-row">
                <div>
                  <strong>Transcribe my voice</strong>
                  <span>Microphone access for your side of the call</span>
                </div>
                <button
                  type="button"
                  className={`btn ${micGranted ? 'btn-secondary' : 'btn-primary'}`}
                  disabled={micBusy || micGranted}
                  onClick={() => void enableMic()}
                >
                  {micGranted ? 'Enabled' : micBusy ? 'Requesting…' : 'Enable microphone'}
                </button>
              </div>

              <div className="onboarding-perm-row">
                <div>
                  <strong>Transcribe other people&apos;s voices</strong>
                  <span>
                    {perms?.platform === 'darwin'
                      ? 'Screen Recording permission for system audio (macOS)'
                      : 'System audio capture is currently optimized for macOS'}
                  </span>
                </div>
                <button
                  type="button"
                  className={`btn ${systemGranted ? 'btn-secondary' : 'btn-primary'}`}
                  disabled={perms?.platform !== 'darwin' || systemGranted}
                  onClick={() => void openSystemAudio()}
                >
                  {systemGranted
                    ? perms?.platform === 'darwin'
                      ? 'Enabled'
                      : 'N/A'
                    : 'Enable system audio'}
                </button>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary onboarding-cta"
              disabled={!canContinue}
              onClick={() => void finish()}
            >
              Continue
            </button>
            {!canContinue ? (
              <p className="onboarding-hint">Enable the microphone to continue.</p>
            ) : null}
          </>
        ) : null}

        <div className="onboarding-dots" aria-hidden="true">
          <span className={step === 'welcome' ? 'is-active' : ''} />
          <span className={step === 'connect' ? 'is-active' : ''} />
          <span className={step === 'permissions' ? 'is-active' : ''} />
        </div>
      </div>
    </div>
  )
}
