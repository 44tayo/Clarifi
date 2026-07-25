/**
 * StatefulButton — async action button with loading / success / error feedback.
 *
 * State machine:
 *   idle → loading → success → idle
 *   idle → loading → error → idle
 *
 * On click (when idle): runs `onClick`, shows spinner, disables the control.
 * On resolve: optional success label + checkmark, then returns to idle after `successDuration`.
 * On reject: error icon briefly, toast(error), then idle. Double-submit is blocked while loading.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'

import { useToast } from '../../hooks/useToast'

type ButtonPhase = 'idle' | 'loading' | 'success' | 'error'

export type StatefulButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link'

export type StatefulButtonProps = {
  onClick: () => Promise<void> | void
  idleLabel: string
  loadingLabel?: string
  successLabel?: string
  icon?: ReactNode
  successDuration?: number
  variant?: StatefulButtonVariant
  size?: 'sm' | 'md'
  className?: string
  disabled?: boolean
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type']
  'aria-label'?: string
  title?: string
  /** When true, omit text labels and rely on icon + aria-label (e.g. header copy-link). */
  iconOnly?: boolean
  /** Skip automatic error toast (caller handles messaging). */
  suppressErrorToast?: boolean
}

const ERROR_DURATION = 1500

function SpinnerIcon() {
  return (
    <svg className="stateful-btn-spinner" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.6" />
      <path
        d="M8 2.5a5.5 5.5 0 0 1 5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11" r="0.9" fill="currentColor" />
    </svg>
  )
}

function variantClass(variant: StatefulButtonVariant): string {
  switch (variant) {
    case 'primary':
      return 'btn btn-primary'
    case 'danger':
      return 'btn btn-danger'
    case 'ghost':
      return 'btn stateful-btn-ghost'
    case 'link':
      return 'stateful-btn-link'
    case 'secondary':
    default:
      return 'btn btn-secondary'
  }
}

export function StatefulButton({
  onClick,
  idleLabel,
  loadingLabel,
  successLabel,
  icon,
  successDuration = 2000,
  variant = 'secondary',
  size = 'md',
  className = '',
  disabled = false,
  type = 'button',
  'aria-label': ariaLabel,
  title,
  iconOnly = false,
  suppressErrorToast = false,
}: StatefulButtonProps) {
  const { toast } = useToast()
  const [phase, setPhase] = useState<ButtonPhase>('idle')
  const resetTimer = useRef<number | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    }
  }, [])

  const scheduleIdle = useCallback((ms: number) => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    resetTimer.current = window.setTimeout(() => {
      if (mounted.current) setPhase('idle')
    }, ms)
  }, [])

  const handleClick = useCallback(async () => {
    if (phase === 'loading' || disabled) return
    setPhase('loading')
    try {
      await onClick()
      if (!mounted.current) return
      setPhase('success')
      scheduleIdle(successDuration)
    } catch (err) {
      if (!mounted.current) return
      setPhase('error')
      if (!suppressErrorToast) {
        const message =
          err instanceof Error && err.message.trim()
            ? err.message
            : 'Something went wrong. Please try again.'
        toast(message, { type: 'error' })
      }
      scheduleIdle(ERROR_DURATION)
    }
  }, [disabled, onClick, phase, scheduleIdle, successDuration, suppressErrorToast, toast])

  const label =
    phase === 'loading'
      ? loadingLabel ?? idleLabel
      : phase === 'success'
        ? successLabel ?? idleLabel
        : idleLabel

  const leadingIcon =
    phase === 'loading' ? (
      <SpinnerIcon />
    ) : phase === 'success' ? (
      <CheckIcon />
    ) : phase === 'error' ? (
      <ErrorIcon />
    ) : (
      icon ?? null
    )

  const classes = [
    'stateful-btn',
    variantClass(variant),
    size === 'sm' ? 'stateful-btn-sm' : '',
    iconOnly ? 'stateful-btn-icon-only' : '',
    phase !== 'idle' ? `is-${phase}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      className={classes}
      onClick={() => void handleClick()}
      disabled={disabled || phase === 'loading'}
      aria-label={ariaLabel ?? (iconOnly ? idleLabel || successLabel || 'Action' : undefined)}
      aria-busy={phase === 'loading'}
      title={title}
      data-phase={phase}
    >
      <span className="stateful-btn-inner">
        {leadingIcon ? <span className="stateful-btn-icon">{leadingIcon}</span> : null}
        {!iconOnly ? <span className="stateful-btn-label">{label}</span> : null}
      </span>
      {/* Invisible sizer keeps width stable across label swaps */}
      {!iconOnly ? (
        <span className="stateful-btn-sizer" aria-hidden>
          <span className="stateful-btn-icon">{icon ?? <CheckIcon />}</span>
          <span className="stateful-btn-label">
            {[idleLabel, loadingLabel, successLabel].filter(Boolean).sort((a, b) => b!.length - a!.length)[0]}
          </span>
        </span>
      ) : null}
    </button>
  )
}
