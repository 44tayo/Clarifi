import { AudioSessionWaveform } from './AudioSessionWaveform'
import { ClarifiLogoMark } from './ClarifiLogoMark'

type WidgetCompactProps = {
  recording: boolean
  paused: boolean
  activity: string
  elapsed: string
  onExpand: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
}

export function WidgetCompact({
  recording,
  paused,
  activity,
  elapsed,
  onExpand,
  onPause,
  onResume,
  onStop,
}: WidgetCompactProps) {
  const showWave = recording && !paused && activity !== 'silent'

  return (
    <div className="widget-compact">
      <button type="button" className="widget-logo-btn" aria-label="Open notepad" onClick={onExpand}>
        <ClarifiLogoMark className="widget-logo-img" />
      </button>
      <span className="widget-compact-timer">{paused ? 'Paused' : elapsed}</span>
      <AudioSessionWaveform active={showWave} size="sm" />
      <div className="widget-compact-spacer" />
      {recording ? (
        paused ? (
          <button type="button" className="widget-btn widget-btn-secondary" aria-label="Resume recording" onClick={onResume}>
            Resume
          </button>
        ) : (
          <button type="button" className="widget-btn widget-btn-secondary" aria-label="Pause recording" onClick={onPause}>
            Pause
          </button>
        )
      ) : null}
      <button type="button" className="widget-btn widget-btn-danger" aria-label="Stop recording" onClick={onStop}>
        <span className="widget-stop-icon" />
        Stop
      </button>
    </div>
  )
}
