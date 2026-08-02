type DictationWaveformButtonProps = {
  active?: boolean
  busy?: boolean
  disabled?: boolean
  onClick?: () => void
  ariaLabel?: string
  className?: string
}

/** Website-matching 4-bar waveform control for chat dictation. */
export function DictationWaveformButton({
  active = false,
  busy = false,
  disabled = false,
  onClick,
  ariaLabel,
  className = '',
}: DictationWaveformButtonProps) {
  const label =
    ariaLabel ??
    (busy ? 'Transcribing…' : active ? 'Stop dictation' : 'Start dictation')

  return (
    <button
      type="button"
      className={`dictation-wave-btn${active ? ' is-active' : ''}${
        busy ? ' is-busy' : ''
      }${className ? ` ${className}` : ''}`}
      onClick={onClick}
      disabled={disabled || busy}
      aria-pressed={active}
      aria-label={label}
      title={label}
    >
      {busy ? (
        <span className="dictation-wave-spinner" aria-hidden />
      ) : (
        <span className={`dictation-wave${active ? ' is-active' : ''}`} aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </span>
      )}
    </button>
  )
}
