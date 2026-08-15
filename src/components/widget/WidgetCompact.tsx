import { AudioSessionWaveform } from './AudioSessionWaveform'
import { ClarifiLogoMark } from './ClarifiLogoMark'

type WidgetCompactProps = {
  recording: boolean
  paused: boolean
  activity: string
  onExpand: () => void
  onPause: () => void
  onResume: () => void
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="2.25" y="1.75" width="2.75" height="8.5" rx="1" fill="currentColor" />
      <rect x="7" y="1.75" width="2.75" height="8.5" rx="1" fill="currentColor" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M3.4 2.1v7.8L10.2 6 3.4 2.1Z" fill="currentColor" />
    </svg>
  )
}

export function WidgetCompact({
  recording,
  paused,
  activity,
  onExpand,
  onPause,
  onResume,
}: WidgetCompactProps) {
  // Animate whenever recording (not paused). Silent still shows a live stream, quieter.
  const showWave = recording && !paused
  const waveActive = showWave && activity !== 'silent'

  return (
    <div className="widget-compact">
      <button
        type="button"
        className="widget-logo-btn"
        aria-label="Open notepad"
        onClick={onExpand}
      >
        <ClarifiLogoMark className="widget-logo-img" size={20} />
      </button>

      <div className="widget-compact-wave">
        <AudioSessionWaveform
          active={waveActive}
          size="sm"
          tone="live"
          bars={7}
          idle={showWave && !waveActive}
        />
      </div>

      {recording ? (
        <button
          type="button"
          className="widget-pause-btn"
          aria-label={paused ? 'Resume recording' : 'Pause recording'}
          onClick={paused ? onResume : onPause}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </button>
      ) : (
        <span className="widget-pause-btn is-placeholder" aria-hidden />
      )}
    </div>
  )
}
