'use client'

import { cn } from '@/lib/utils'

import './audio-session-waveform.css'

type AudioSessionWaveformButtonProps = {
  active?: boolean
  onClick?: () => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'on-dark' | 'default'
  className?: string
  ariaLabel?: string
}

export function AudioSessionWaveformButton({
  active = false,
  onClick,
  disabled = false,
  size = 'md',
  variant = 'on-dark',
  className,
  ariaLabel = active ? 'Stop audio session' : 'Start audio session',
}: AudioSessionWaveformButtonProps) {
  const waveform = (
    <span className={cn('as-waveform', active && 'as-waveform--active')} aria-hidden>
      <span />
      <span />
      <span />
      <span />
    </span>
  )

  if (disabled && !onClick) {
    return (
      <span
        className={cn(
          'as-waveform-btn',
          `as-waveform-btn--${size}`,
          `as-waveform-btn--${variant}`,
          active && 'as-waveform-btn--active',
          className,
        )}
        aria-hidden
      >
        {waveform}
      </span>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        'as-waveform-btn',
        `as-waveform-btn--${size}`,
        `as-waveform-btn--${variant}`,
        active && 'as-waveform-btn--active',
        className,
      )}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={ariaLabel}
    >
      {waveform}
    </button>
  )
}
