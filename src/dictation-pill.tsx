'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { DictationSession, type DictationSessionState, type DictationTargetSnapshot } from './lib/dictationSession'

import './dictation-pill.css'

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function Waveform() {
  return (
    <div className="dp-waveform" aria-hidden>
      {Array.from({ length: 11 }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  )
}

export function DictationPill() {
  const [state, setState] = useState<DictationSessionState>('idle')
  const [hovered, setHovered] = useState(false)
  const [status, setStatus] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [blockedReason, setBlockedReason] = useState('')
  const sessionRef = useRef<DictationSession | null>(null)
  const statusTimerRef = useRef<number | null>(null)

  const session = useMemo(() => {
    const instance = new DictationSession({
      onStateChange: setState,
      onStatus: (message, durationMs = 2500) => {
        setStatus(message)
        if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current)
        statusTimerRef.current = window.setTimeout(() => setStatus(''), durationMs)
      },
    })
    sessionRef.current = instance
    return instance
  }, [])

  const setInteractive = useCallback((interactive: boolean) => {
    void window.electronAPI.invoke('dictation-pill:set-interactive', { interactive })
  }, [])

  useEffect(() => {
    setInteractive(state !== 'idle' || hovered)
  }, [hovered, setInteractive, state])

  useEffect(() => {
    session.prepare()

    const refreshTimer = window.setInterval(() => {
      session.prepare()
    }, 30_000)

    return () => {
      window.clearInterval(refreshTimer)
      if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current)
    }
  }, [session])

  useEffect(() => {
    const blockedRef = { current: blocked }
    blockedRef.current = blocked
    const blockedReasonRef = { current: blockedReason }
    blockedReasonRef.current = blockedReason

    const onBlocked = (...args: unknown[]) => {
      const payload = args[0] as { blocked?: boolean; reason?: string }
      setBlocked(Boolean(payload?.blocked))
      setBlockedReason(payload?.reason ?? '')
    }
    const onStart = (...args: unknown[]) => {
      const snapshot = args[0] as DictationTargetSnapshot | null | undefined
      void sessionRef.current?.start({
        blocked: blockedRef.current,
        blockedReason: blockedReasonRef.current,
        snapshot,
      })
    }
    const onFinish = () => {
      void sessionRef.current?.finish()
    }
    const onCancel = () => {
      sessionRef.current?.cancel()
    }

    window.electronAPI.on('dictation:session-start', onStart)
    window.electronAPI.on('dictation:session-finish', onFinish)
    window.electronAPI.on('dictation:session-cancel', onCancel)
    window.electronAPI.on('dictation:blocked-changed', onBlocked)

    void window.electronAPI.invoke('dictation-pill:subscribe')
    void window.electronAPI.invoke('dictation-pill:ready')
  }, [])

  const handleIdleClick = async () => {
    if (state !== 'idle') return
    const snapshot = (await window.electronAPI.invoke('dictation:capture-target')) as
      | DictationTargetSnapshot
      | null
    void session.start({ blocked, blockedReason, snapshot })
  }

  const handleCancel = () => {
    session.cancel()
  }

  const handleFinish = () => {
    void session.finish()
  }

  const showMic = state === 'idle' && hovered
  const pillClass =
    state === 'recording'
      ? 'dp-pill dp-pill-recording'
      : state === 'processing'
        ? 'dp-pill dp-pill-processing'
        : showMic
          ? 'dp-pill dp-pill-hover'
          : 'dp-pill dp-pill-idle'

  return (
    <div
      className="dp-root"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="dp-shell">
        {status ? <p className="dp-status">{status}</p> : null}

        {state === 'recording' ? (
          <div className={pillClass} role="group" aria-label="Dictation controls">
            <button
              type="button"
              className="dp-icon-btn"
              onClick={handleCancel}
              aria-label="Cancel dictation"
            >
              <CloseIcon />
            </button>
            <Waveform />
            <button
              type="button"
              className="dp-icon-btn confirm"
              onClick={handleFinish}
              aria-label="Finish and paste dictation"
            >
              <CheckIcon />
            </button>
          </div>
        ) : state === 'processing' ? (
          <div className={pillClass} aria-label="Processing dictation">
            <span className="dp-spinner" aria-hidden />
          </div>
        ) : (
          <button
            type="button"
            className={pillClass}
            onClick={handleIdleClick}
            aria-label={showMic ? 'Start dictation' : 'Dictation'}
            title={blocked ? blockedReason : 'Click or hold Fn to dictate'}
          >
            {showMic ? (
              <span className="dp-mic-icon">
                <MicIcon />
              </span>
            ) : null}
          </button>
        )}
      </div>
    </div>
  )
}
