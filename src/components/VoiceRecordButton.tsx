function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  )
}

type VoiceRecordButtonProps = {
  isRecording: boolean
  isPaused?: boolean
  onToggle: () => void
  onTogglePause?: () => void
  disabled?: boolean
  className?: string
}

export function VoiceRecordButton({
  isRecording,
  isPaused = false,
  onToggle,
  onTogglePause,
  disabled = false,
  className = '',
}: VoiceRecordButtonProps) {
  return (
    <div className={`toolbar-record-controls ${className}`.trim()}>
      {isRecording && onTogglePause && (
        <button
          type="button"
          className={`toolbar-icon pause-btn toolbar-record-pause ${isPaused ? 'paused' : ''}`}
          onClick={onTogglePause}
          disabled={disabled}
          aria-label={isPaused ? 'Resume session' : 'Pause session'}
        >
          {isPaused ? '▶' : '⏸'}
        </button>
      )}
      <button
        type="button"
        className={`toolbar-icon toolbar-record-btn ${isRecording ? 'active' : ''}`}
        onClick={onToggle}
        disabled={disabled}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isRecording ? (
          <span className="voice-spin-rect" aria-hidden />
        ) : (
          <MicIcon />
        )}
      </button>
    </div>
  )
}
