'use client'

import { useEffect, useRef } from 'react'
import './video-call-demo.css'

export type VideoCallDemoProps = {
  localSrc: string
  remoteSrc: string
  localName?: string
  remoteName?: string
  meetingTitle?: string
  variant?: 'full' | 'window'
  layout?: 'default' | 'hero'
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  )
}

function VideoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
    </svg>
  )
}

function MicOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5.5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c.57-.08 1.12-.25 1.64-.47l2.27 2.27 1.41-1.41L4.27 3z" />
    </svg>
  )
}

function VideoOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27l3.15 3.15C5.06 6.74 4.5 7.38 4.5 8.5v7c0 1.1.9 2 2 2h7.73l4.73 4.73 1.27-1.27L3.27 2zM17 10.5l-1.73-1.73L17 7.27V10.5z" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h4v-2H4V6h16v10h-4v2h4z" />
      <path d="M12 16l4-4-4-4v3H4v2h8v3z" />
    </svg>
  )
}

function rootClass(variant: string, layout: string) {
  const parts = ['vcd-root']
  if (variant === 'window') parts.push('vcd-root--window')
  if (layout === 'hero') parts.push('vcd-root--hero')
  return parts.join(' ')
}

export function VideoCallDemo({
  localSrc,
  remoteSrc,
  localName = 'You',
  remoteName = 'Them',
  meetingTitle = 'Team meeting',
  variant = 'full',
  layout = 'default',
}: VideoCallDemoProps) {
  const localRef = useRef<HTMLVideoElement>(null)
  const remoteRef = useRef<HTMLVideoElement>(null)
  const isHero = layout === 'hero'

  useEffect(() => {
    const local = localRef.current
    const remote = remoteRef.current
    if (!local || !remote) return

    const sync = () => {
      if (Math.abs(local.currentTime - remote.currentTime) > 0.3) {
        remote.currentTime = local.currentTime
      }
    }

    const playBoth = async () => {
      try {
        local.muted = true
        remote.muted = true
        await Promise.all([local.play(), remote.play()])
      } catch {
        /* autoplay may be blocked until interaction */
      }
    }

    local.addEventListener('timeupdate', sync)
    void playBoth()

    return () => local.removeEventListener('timeupdate', sync)
  }, [localSrc, remoteSrc])

  return (
    <div className={rootClass(variant, layout)}>
      {variant === 'window' ? (
        <div className="vcd-chrome" aria-hidden>
          <span className="vcd-dot red" />
          <span className="vcd-dot yellow" />
          <span className="vcd-dot green" />
        </div>
      ) : null}

      {!isHero ? (
        <header className="vcd-header">
          <span className="vcd-header-title">{meetingTitle}</span>
          <span className="vcd-header-timer">00:14</span>
        </header>
      ) : null}

      <div className="vcd-tiles">
        <div className="vcd-tile">
          <video
            ref={localRef}
            className="vcd-video"
            src={localSrc}
            autoPlay
            muted
            loop
            playsInline
          />
          {!isHero ? <span className="vcd-name">{localName}</span> : null}
        </div>
        <div className="vcd-tile">
          <video
            ref={remoteRef}
            className="vcd-video"
            src={remoteSrc}
            autoPlay
            muted
            loop
            playsInline
          />
          {!isHero ? <span className="vcd-name">{remoteName}</span> : null}
        </div>
      </div>

      <footer className={`vcd-controls ${isHero ? 'vcd-controls--hero' : ''}`}>
        <div className="vcd-controls-left">
          <button type="button" className="vcd-control" aria-label={isHero ? 'Mute' : 'Unmute'}>
            {isHero ? <MicOffIcon /> : <MicIcon />}
            <span>{isHero ? 'Mute' : 'Unmute'}</span>
          </button>
          <button type="button" className="vcd-control" aria-label="Start Video">
            {isHero ? <VideoOffIcon /> : <VideoIcon />}
            <span>Start Video</span>
          </button>
          {!isHero ? (
            <button type="button" className="vcd-control" aria-label="Share Screen">
              <ShareIcon />
              <span>Share</span>
            </button>
          ) : null}
        </div>
        <button type="button" className="vcd-control vcd-end" aria-label="End call">
          End
        </button>
      </footer>
    </div>
  )
}
