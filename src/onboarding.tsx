import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import './onboarding.css'
import OverlayMock from './OverlayMock'
import DictationPillMock from './DictationPillMock'
import SignInEmbed from './SignInEmbed'
import { ClarifiLogo, SlideToContinue } from './onboarding-welcome'

type Step =
  | 'welcome'
  | 'sign-in'
  | 'permissions'
  | 'tour-intro'
  | 'tour-toggle'
  | 'tour-ask'
  | 'tour-chat'
  | 'tour-screen'
  | 'tour-audio'
  | 'tour-dictation'
  | 'tour-stealth'
  | 'tour-move'
  | 'tour-sessions'
  | 'ready'

type PermissionKind = 'accessibility' | 'microphone' | 'screen'

type PermissionState = {
  accessibility: boolean
  microphone: boolean
  screen: boolean
  allGranted: boolean
}

type TutorialStep =
  | 'toggle'
  | 'enter'
  | 'chat'
  | 'screen'
  | 'listen'
  | 'stealth'
  | 'move'
  | 'sessions'

const STEPS: Step[] = [
  'welcome',
  'sign-in',
  'permissions',
  'tour-intro',
  'tour-toggle',
  'tour-ask',
  'tour-chat',
  'tour-screen',
  'tour-audio',
  'tour-dictation',
  'tour-stealth',
  'tour-move',
  'tour-sessions',
  'ready',
]

const LIVE_TOUR_STEPS: Step[] = [
  'tour-intro',
  'tour-toggle',
  'tour-ask',
  'tour-chat',
  'tour-screen',
  'tour-audio',
  'tour-dictation',
  'tour-stealth',
  'tour-move',
  'tour-sessions',
]

function LiveTourHint({ children }: { children: ReactNode }) {
  return (
    <div className="live-tour-hint">
      <div className="live-tour-hint-badge">
        <span>↑</span> Live overlay active
      </div>
      <p>{children}</p>
    </div>
  )
}

type PreviewPanelProps = {
  step: Step
  mockOffset: { x: number; y: number }
  onPreviewListen: () => void
  onPreviewStealth: () => void
}

function PreviewPanel({ step, mockOffset, onPreviewListen, onPreviewStealth }: PreviewPanelProps) {
  const [previewRecording, setPreviewRecording] = useState(false)

  useEffect(() => {
    setPreviewRecording(false)
  }, [step])

  if (step === 'welcome') {
    return (
      <div className="preview-welcome-scene">
        <div className="preview-welcome-scene-bg">
          <OverlayMock placeholder="Ask me anything" />
          <p className="preview-welcome-tagline">
            Your real-time AI assistant,
            <br />
            always ready to help.
          </p>
        </div>
      </div>
    )
  }

  if (step === 'sign-in') {
    return <SignInEmbed />
  }

  if (step === 'permissions') {
    return (
      <div className="preview-settings-stack">
        <div className="preview-dialog">
          <div className="preview-dialog-title">
            <span>🔒</span>
            <span>
              &quot;Clarifi&quot; would like to control this computer using accessibility
              features.
            </span>
          </div>
          <p>Open System Settings and enable Clarifi under Privacy &amp; Security.</p>
          <div className="preview-dialog-actions">
            <button type="button" className="preview-dialog-btn preview-dialog-btn-primary">
              Open System Settings
            </button>
            <button type="button" className="preview-dialog-btn preview-dialog-btn-secondary">
              Deny
            </button>
          </div>
        </div>
        <div className="preview-settings-pane">
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Accessibility</div>
          <div className="preview-settings-row">
            <span>Clarifi</span>
            <div className="preview-settings-toggle" />
          </div>
          <div className="preview-settings-row">
            <span>Slack</span>
            <div className="preview-settings-toggle off" />
          </div>
        </div>
      </div>
    )
  }

  if (step === 'tour-intro') {
    return (
      <OverlayMock
        placeholder="Ask me anything"
        showChatPanel
        highlight="toolbar"
        footer={
          <LiveTourHint>
            This is the Clarifi bar — a small overlay at the top of your screen. The next steps use
            the <strong>live bar</strong> above your desktop.
          </LiveTourHint>
        }
      />
    )
  }

  if (step === 'tour-toggle') {
    return (
      <OverlayMock
        placeholder="Ask me anything"
        highlight="toolbar"
        footer={
          <LiveTourHint>
            Press <strong>⌘F</strong> on the live bar to show or hide Clarifi any time.
          </LiveTourHint>
        }
      />
    )
  }

  if (step === 'tour-ask') {
    return (
      <OverlayMock placeholder="What's on my screen?" highlight="input" footer={<LiveTourHint>Type a question in the live bar, then press <strong>Enter</strong> to submit.</LiveTourHint>} />
    )
  }

  if (step === 'tour-chat') {
    return (
      <OverlayMock
        showChatPanel
        highlight="chat"
        footer={
          <LiveTourHint>
            Answers open in a panel below the bar. Press <strong>← Back</strong> on the live overlay
            to collapse it.
          </LiveTourHint>
        }
      />
    )
  }

  if (step === 'tour-screen') {
    return (
      <OverlayMock
        screenContextEnabled
        highlight="screen"
        footer={
          <LiveTourHint>
            Turn on the <strong>screen icon</strong> on the live bar before asking about what you
            see.
          </LiveTourHint>
        }
      />
    )
  }

  if (step === 'tour-audio') {
    return (
      <OverlayMock
        isRecording={previewRecording}
        highlight="audio"
        onAudioClick={() => {
          setPreviewRecording(true)
          onPreviewListen()
        }}
        footer={
          <LiveTourHint>
            Tap the <strong>waveform</strong> on the live bar to start or stop a listening session.
          </LiveTourHint>
        }
      />
    )
  }

  if (step === 'tour-dictation') {
    return <DictationPillMock />
  }

  if (step === 'tour-stealth') {
    return (
      <OverlayMock
        stealthEnabled
        highlight="stealth"
        onStealthClick={onPreviewStealth}
        footer={
          <LiveTourHint>
            The <strong>green eye</strong> means Clarifi is hidden from screen share and recordings.
          </LiveTourHint>
        }
      />
    )
  }

  if (step === 'tour-move') {
    return (
      <OverlayMock
        showMoveArrows
        highlight="toolbar"
        style={{ transform: `translate(${mockOffset.x}px, ${mockOffset.y}px)` }}
        footer={
          <LiveTourHint>
            Drag the live toolbar to reposition, or use <strong>⌘ + arrow keys</strong>.
          </LiveTourHint>
        }
      />
    )
  }

  if (step === 'tour-sessions') {
    return (
      <OverlayMock
        highlight="sessions"
        footer={
          <LiveTourHint>
            Open <strong>Sessions</strong> or <strong>History</strong> on the live bar to revisit
            recordings and past chats.
          </LiveTourHint>
        }
      />
    )
  }

  if (step === 'ready') {
    return (
      <div className="preview-complete">
        <div className="preview-complete-icon">✓</div>
        <h3>You&apos;re ready</h3>
        <p style={{ marginTop: 12, fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
          Press <strong>⌘F</strong> whenever you need Clarifi. Replay this tour anytime from
          Settings.
        </p>
      </div>
    )
  }

  return null
}

function PermissionRow({
  title,
  description,
  granted,
  onToggle,
}: {
  title: string
  description: string
  granted: boolean
  onToggle: () => void
}) {
  return (
    <div className="permission-row">
      <div className={`permission-icon ${granted ? 'granted' : 'pending'}`}>
        {granted ? '✓' : ''}
      </div>
      <div className="permission-body">
        <div className="permission-title">{title}</div>
        <div className="permission-desc">{description}</div>
      </div>
      <button
        type="button"
        className={`permission-toggle ${granted ? 'on' : 'off'}`}
        onClick={onToggle}
        aria-label={`${title} permission`}
      />
    </div>
  )
}

export default function OnboardingApp() {
  const [step, setStep] = useState<Step>('welcome')
  const [signInStatus, setSignInStatus] = useState<'idle' | 'waiting' | 'connected' | 'error'>(
    'idle',
  )
  const [signInError, setSignInError] = useState('')
  const [permissions, setPermissions] = useState<PermissionState>({
    accessibility: false,
    microphone: false,
    screen: false,
    allGranted: false,
  })
  const [tutorialDone, setTutorialDone] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [mockOffset, setMockOffset] = useState({ x: 0, y: 0 })

  const stepIndex = STEPS.indexOf(step)
  const canGoBack = stepIndex > 0 && step !== 'welcome'

  const goNext = useCallback(() => {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) {
      setStep(STEPS[idx + 1])
      setTutorialDone(false)
      setMockOffset({ x: 0, y: 0 })
    }
  }, [step])

  const goBack = useCallback(() => {
    const idx = STEPS.indexOf(step)
    if (idx > 0) {
      void window.electronAPI.invoke('onboarding:stop-tutorial')
      setStep(STEPS[idx - 1])
      setTutorialDone(false)
      setMockOffset({ x: 0, y: 0 })
    }
  }, [step])

  const finishOnboarding = useCallback(async () => {
    if (completing) return
    setCompleting(true)
    try {
      await window.electronAPI.invoke('onboarding:stop-tutorial')
      await window.electronAPI.invoke('onboarding:complete')
    } catch {
      setCompleting(false)
    }
  }, [completing])

  const refreshPermissions = useCallback(async () => {
    const result = (await window.electronAPI.invoke('permissions:status')) as PermissionState
    setPermissions(result)
  }, [])

  const refreshConnection = useCallback(async () => {
    const result = (await window.electronAPI.invoke('auth:connection-status')) as {
      connected?: boolean
      hasApiUrl?: boolean
    }
    if (!result.hasApiUrl) {
      setSignInStatus('connected')
      return true
    }
    if (result.connected) {
      setSignInStatus('connected')
      return true
    }
    return false
  }, [])

  const requestPermission = useCallback(
    async (kind: PermissionKind) => {
      await window.electronAPI.invoke('permissions:request', { kind })
      await refreshPermissions()
    },
    [refreshPermissions],
  )

  const openSignIn = useCallback(async () => {
    setSignInError('')
    setSignInStatus('waiting')
    try {
      await window.electronAPI.invoke('auth:open-sign-in')
    } catch {
      setSignInStatus('error')
      setSignInError('Could not open browser')
    }
  }, [])

  // Sign-in: poll connection + listen for deep link
  useEffect(() => {
    if (step !== 'sign-in') return

    void refreshConnection()

    const onAuth = () => {
      setSignInStatus('connected')
    }
    window.electronAPI.on('onboarding:auth-connected', onAuth)

    const interval = window.setInterval(() => {
      void refreshConnection()
    }, 2000)

    return () => window.clearInterval(interval)
  }, [step, refreshConnection])

  // Auto-advance when signed in
  useEffect(() => {
    if (step === 'sign-in' && signInStatus === 'connected') {
      const timer = window.setTimeout(() => goNext(), 600)
      return () => window.clearTimeout(timer)
    }
  }, [step, signInStatus, goNext])

  // Permissions polling
  useEffect(() => {
    if (step !== 'permissions') return
    void refreshPermissions()
    const interval = window.setInterval(() => {
      void refreshPermissions()
    }, 1000)
    return () => window.clearInterval(interval)
  }, [step, refreshPermissions])

  // Live overlay tour — show real bar alongside onboarding
  useEffect(() => {
    if (LIVE_TOUR_STEPS.includes(step)) {
      void window.electronAPI.invoke('onboarding:begin-live-tour')
      return
    }
    if (step === 'welcome' || step === 'sign-in' || step === 'permissions') {
      void window.electronAPI.invoke('onboarding:end-live-tour')
    }
  }, [step])

  // Tutorial steps (drives shortcuts + live overlay highlights)
  const tutorialStep: TutorialStep | null = useMemo(() => {
    if (step === 'tour-toggle') return 'toggle'
    if (step === 'tour-ask') return 'enter'
    if (step === 'tour-chat') return 'chat'
    if (step === 'tour-screen') return 'screen'
    if (step === 'tour-audio') return 'listen'
    if (step === 'tour-stealth') return 'stealth'
    if (step === 'tour-move') return 'move'
    if (step === 'tour-sessions') return 'sessions'
    return null
  }, [step])

  useEffect(() => {
    if (!tutorialStep) {
      void window.electronAPI.invoke('onboarding:stop-tutorial')
      return
    }

    setTutorialDone(false)
    void window.electronAPI.invoke('onboarding:start-tutorial', { step: tutorialStep })

    const onTutorial = (payload: unknown) => {
      const data = payload as { type?: TutorialStep }
      if (data.type === tutorialStep) {
        setTutorialDone(true)
      }
    }
    window.electronAPI.on('onboarding:tutorial-event', onTutorial)

    return () => {
      void window.electronAPI.invoke('onboarding:stop-tutorial')
    }
  }, [tutorialStep])

  useEffect(() => {
    const onNudge = (payload: unknown) => {
      const data = payload as { dx?: number; dy?: number }
      const dx = data.dx
      const dy = data.dy
      if (typeof dx !== 'number' || typeof dy !== 'number') return
      setMockOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
    }
    window.electronAPI.on('onboarding:mock-nudge', onNudge)
  }, [])

  const signalPreviewListen = useCallback(() => {
    void window.electronAPI.invoke('onboarding:tutorial-signal', { type: 'listen' })
  }, [])

  const signalPreviewStealth = useCallback(() => {
    void window.electronAPI.invoke('onboarding:tutorial-signal', { type: 'stealth' })
  }, [])

  const permissionCta = useMemo(() => {
    if (permissions.accessibility) {
      if (permissions.microphone) {
        if (!permissions.screen) return { label: 'Allow screen access', kind: 'screen' as const }
        return null
      }
      return { label: 'Allow microphone access', kind: 'microphone' as const }
    }
    return { label: 'Allow accessibility access', kind: 'accessibility' as const }
  }, [permissions])

  let leftContent: ReactNode
  let primaryCta: ReactNode
  let secondaryCta: ReactNode = null

  if (step === 'welcome') {
    leftContent = (
      <>
        <div className="onboarding-brand">
          <ClarifiLogo />
          <div className="onboarding-brand-text">
            <h1>Welcome to Clarifi</h1>
            <p>The ultimate AI meeting co-pilot.</p>
          </div>
        </div>
        <p className="onboarding-sub" style={{ marginTop: 0 }}>
          Real-time answers and perfect notes — invisible on your screen, invisible on screen share.
        </p>
      </>
    )
    primaryCta = <SlideToContinue onComplete={goNext} />
  } else if (step === 'sign-in') {
    leftContent = (
      <>
        <h2 className="onboarding-heading">Sign in to continue</h2>
        <p className="onboarding-sub">
          Use the panel on the right to sign in or create an account. Google, Apple, and email are
          supported. Clarifi Desktop links automatically when you&apos;re done.
        </p>
        {signInStatus === 'connected' && (
          <p className="onboarding-status-text success">Account connected!</p>
        )}
        {signInError && <p className="onboarding-status-text error">{signInError}</p>}
      </>
    )
    primaryCta =
      signInStatus === 'connected' ? (
        <button type="button" className="onboarding-cta onboarding-cta-primary" onClick={goNext}>
          Continue
          <span>›</span>
        </button>
      ) : (
        <p className="onboarding-status-text">Sign in on the right to continue</p>
      )
    secondaryCta = (
      <button type="button" className="onboarding-skip" onClick={() => void openSignIn()}>
        Open in browser instead
      </button>
    )
  } else if (step === 'permissions') {
    leftContent = (
      <>
        <h2 className="onboarding-heading">Let&apos;s get you set up</h2>
        <p className="onboarding-sub">
          Clarifi needs a few permissions to assist you during meetings and on your screen.
        </p>
        <div className="permission-list">
          <PermissionRow
            title="Allow Clarifi to assist"
            description="Needed for dictation into other apps, Fn hold-to-talk, and global shortcuts."
            granted={permissions.accessibility}
            onToggle={() => void requestPermission('accessibility')}
          />
          <PermissionRow
            title="Allow Clarifi to hear audio"
            description="Clarifi uses your mic for live sessions and hold-to-talk dictation."
            granted={permissions.microphone}
            onToggle={() => void requestPermission('microphone')}
          />
          <PermissionRow
            title="Allow Clarifi to see your screen"
            description="Clarifi can answer questions about what you're viewing."
            granted={permissions.screen}
            onToggle={() => void requestPermission('screen')}
          />
        </div>
        {permissions.allGranted && (
          <p className="onboarding-status-text success">All permissions granted</p>
        )}
      </>
    )
    if (permissions.allGranted) {
      primaryCta = (
        <button type="button" className="onboarding-cta onboarding-cta-primary" onClick={goNext}>
          Continue
          <span>›</span>
        </button>
      )
    } else if (permissionCta) {
      primaryCta = (
        <button
          type="button"
          className="onboarding-cta onboarding-cta-primary"
          onClick={() => void requestPermission(permissionCta.kind)}
        >
          {permissionCta.label}
        </button>
      )
    }
  } else if (step === 'tour-intro') {
    leftContent = (
      <>
        <h2 className="onboarding-heading">Meet your overlay</h2>
        <p className="onboarding-sub">
          Clarifi lives in a small bar at the top of your screen — not a normal app window. The
          preview shows the layout; the next steps use the <strong>live bar</strong> on your
          desktop.
        </p>
        <ul className="onboarding-tour-list">
          <li>Top row — type questions here</li>
          <li>Toolbar — modes, screen, stealth, audio, history</li>
          <li>Chat panel — opens below when you ask something</li>
        </ul>
      </>
    )
    primaryCta = (
      <button type="button" className="onboarding-cta onboarding-cta-primary" onClick={goNext}>
        Start the tour
        <span>›</span>
      </button>
    )
  } else if (step === 'tour-toggle') {
    leftContent = (
      <>
        <h2 className="onboarding-heading">Show and hide Clarifi</h2>
        <p className="onboarding-sub">
          The overlay is easy to miss. Use this shortcut any time to toggle it on or off.
        </p>
        <div className="onboarding-press-row">
          <span className="onboarding-kbd">⌘</span>
          <span className="onboarding-kbd-plus">+</span>
          <span className="onboarding-kbd">F</span>
        </div>
      </>
    )
    primaryCta = (
      <button
        type="button"
        className="onboarding-cta onboarding-cta-secondary"
        onClick={goNext}
        disabled={!tutorialDone}
      >
        {tutorialDone ? 'Continue' : 'Press ⌘F on the live bar'}
        {tutorialDone && <span>›</span>}
      </button>
    )
  } else if (step === 'tour-ask') {
    leftContent = (
      <>
        <h2 className="onboarding-heading">Ask a question</h2>
        <p className="onboarding-sub">
          Type in the live bar, then submit. Try &ldquo;What&apos;s on my screen?&rdquo; — you&apos;ll
          enable screen access in a later step.
        </p>
        <div className="onboarding-press-row">
          <span className="onboarding-kbd">↵</span>
        </div>
      </>
    )
    primaryCta = (
      <button
        type="button"
        className="onboarding-cta onboarding-cta-secondary"
        onClick={goNext}
        disabled={!tutorialDone}
      >
        {tutorialDone ? 'Continue' : 'Submit a question with Enter'}
        {tutorialDone && <span>›</span>}
      </button>
    )
  } else if (step === 'tour-chat') {
    leftContent = (
      <>
        <h2 className="onboarding-heading">The chat panel</h2>
        <p className="onboarding-sub">
          Answers open in a panel below the bar. Use the back arrow to collapse to the compact bar
          when you want more screen space.
        </p>
      </>
    )
    primaryCta = (
      <button
        type="button"
        className="onboarding-cta onboarding-cta-secondary"
        onClick={goNext}
        disabled={!tutorialDone}
      >
        {tutorialDone ? 'Continue' : 'Press ← Back on the live overlay'}
        {tutorialDone && <span>›</span>}
      </button>
    )
  } else if (step === 'tour-screen') {
    leftContent = (
      <>
        <h2 className="onboarding-heading">Screen context</h2>
        <p className="onboarding-sub">
          Turn on the <strong>screen icon</strong> before asking about what you&apos;re viewing.
          macOS must allow screen recording for Clarifi.
        </p>
      </>
    )
    primaryCta = (
      <button
        type="button"
        className="onboarding-cta onboarding-cta-secondary"
        onClick={goNext}
        disabled={!tutorialDone}
      >
        {tutorialDone ? 'Continue' : 'Enable screen context on the live bar'}
        {tutorialDone && <span>›</span>}
      </button>
    )
  } else if (step === 'tour-audio') {
    leftContent = (
      <>
        <h2 className="onboarding-heading">Listen in meetings</h2>
        <p className="onboarding-sub">
          Tap the waveform button to start an audio session. Clarifi transcribes your microphone and
          meeting audio in real time.
        </p>
      </>
    )
    primaryCta = (
      <button
        type="button"
        className="onboarding-cta onboarding-cta-secondary"
        onClick={goNext}
        disabled={!tutorialDone}
      >
        {tutorialDone ? 'Continue' : 'Start a session on the live bar'}
        {tutorialDone && <span>›</span>}
      </button>
    )
  } else if (step === 'tour-dictation') {
    leftContent = (
      <>
        <h2 className="onboarding-heading">Dictate anywhere</h2>
        <p className="onboarding-sub">
          Hold <strong>Fn (Globe)</strong> on Mac or <strong>Right Ctrl</strong> on Windows — or click
          the bottom pill — to dictate into any text field. Clarifi cleans up filler words and inserts
          polished text at your cursor.
        </p>
        <div className="onboarding-press-row">
          <span className="onboarding-kbd">Fn</span>
          <span className="onboarding-kbd-label">hold to talk</span>
        </div>
      </>
    )
    primaryCta = (
      <button type="button" className="onboarding-cta onboarding-cta-primary" onClick={goNext}>
        Continue
        <span>›</span>
      </button>
    )
  } else if (step === 'tour-stealth') {
    leftContent = (
      <>
        <h2 className="onboarding-heading">Stay hidden on share</h2>
        <p className="onboarding-sub">
          The <strong>green eye</strong> means Clarifi is hidden from Zoom, Meet, and screen
          recordings. Tap it on the live bar to toggle.
        </p>
      </>
    )
    primaryCta = (
      <button
        type="button"
        className="onboarding-cta onboarding-cta-secondary"
        onClick={goNext}
        disabled={!tutorialDone}
      >
        {tutorialDone ? 'Continue' : 'Tap the eye icon on the live bar'}
        {tutorialDone && <span>›</span>}
      </button>
    )
  } else if (step === 'tour-move') {
    leftContent = (
      <>
        <h2 className="onboarding-heading">Move the overlay</h2>
        <p className="onboarding-sub">
          Drag the toolbar to reposition, or nudge it with the keyboard.
        </p>
        <div className="onboarding-shortcut-row">
          <div className="onboarding-arrow-grid">
            <div className="spacer" />
            <span className="onboarding-kbd">↑</span>
            <div className="spacer" />
            <span className="onboarding-kbd">←</span>
            <div className="spacer" />
            <span className="onboarding-kbd">→</span>
            <div className="spacer" />
            <span className="onboarding-kbd">↓</span>
            <div className="spacer" />
          </div>
          <div className="onboarding-press-row">
            <span className="onboarding-kbd">⌘</span>
            <span className="onboarding-kbd-plus">+</span>
            <span className="onboarding-kbd-label">arrow keys</span>
          </div>
        </div>
      </>
    )
    primaryCta = (
      <button
        type="button"
        className="onboarding-cta onboarding-cta-secondary"
        onClick={goNext}
        disabled={!tutorialDone}
      >
        {tutorialDone ? 'Continue' : 'Move the live bar with ⌘ + arrows'}
        {tutorialDone && <span>›</span>}
      </button>
    )
  } else if (step === 'tour-sessions') {
    leftContent = (
      <>
        <h2 className="onboarding-heading">Sessions &amp; history</h2>
        <p className="onboarding-sub">
          <strong>Sessions</strong> stores audio recordings and recaps. <strong>History</strong>{' '}
          keeps your past chats. Open either from the right side of the toolbar.
        </p>
      </>
    )
    primaryCta = (
      <button
        type="button"
        className="onboarding-cta onboarding-cta-secondary"
        onClick={goNext}
        disabled={!tutorialDone}
      >
        {tutorialDone ? 'Continue' : 'Open Sessions or History on the live bar'}
        {tutorialDone && <span>›</span>}
      </button>
    )
  } else if (step === 'ready') {
    leftContent = (
      <>
        <h2 className="onboarding-heading">You&apos;re all set</h2>
        <p className="onboarding-sub">
          Clarifi is ready. Press <strong>⌘F</strong> for the overlay, or hold <strong>Fn</strong> to
          dictate into any app. Replay this tour from Settings → Replay product tour.
        </p>
      </>
    )
    primaryCta = (
      <button
        type="button"
        className="onboarding-cta onboarding-cta-primary"
        onClick={() => void finishOnboarding()}
        disabled={completing}
      >
        {completing ? 'Opening Clarifi…' : 'Open Clarifi'}
        <span>›</span>
      </button>
    )
  }

  return (
    <div className="onboarding-root">
      <div className="onboarding-drag-region" aria-hidden />
      <div className="onboarding-panel onboarding-panel-left">
        {canGoBack && (
          <button type="button" className="onboarding-back" onClick={goBack}>
            ← Back
          </button>
        )}

        <div className="onboarding-content">
          {leftContent}
          <div className="onboarding-footer">
            {primaryCta}
            {step === 'welcome' && (
              <p className="onboarding-legal">
                By signing up, you agree to our Terms of Service and Privacy Policy.
              </p>
            )}
            {secondaryCta}
          </div>
        </div>
      </div>

      <div className={`onboarding-preview ${step === 'sign-in' ? 'onboarding-preview-sign-in' : ''}`}>
        {step !== 'sign-in' && <div className="onboarding-preview-grid" />}
        {permissions.allGranted && step === 'permissions' ? (
          <div className="preview-complete">
            <div className="preview-complete-icon">✓</div>
            <h3>All set!</h3>
          </div>
        ) : (
          <PreviewPanel
            step={step}
            mockOffset={mockOffset}
            onPreviewListen={signalPreviewListen}
            onPreviewStealth={signalPreviewStealth}
          />
        )}
      </div>
    </div>
  )
}
