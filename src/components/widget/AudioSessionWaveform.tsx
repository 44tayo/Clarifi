type AudioSessionWaveformProps = {
  active: boolean
  size?: 'sm' | 'md'
  /** `live` = recording red bars (compact HUD). Default accent blue. */
  tone?: 'accent' | 'live'
  bars?: 3 | 4 | 7
  /** Soft idle motion while recording but silent. */
  idle?: boolean
}

export function AudioSessionWaveform({
  active,
  size = 'sm',
  tone = 'accent',
  bars = 4,
  idle = false,
}: AudioSessionWaveformProps) {
  const count = bars === 7 ? 7 : bars === 3 ? 3 : 4
  const stateClass = active ? ' is-active' : idle ? ' is-idle' : ''
  return (
    <span
      className={`widget-audio-wave widget-audio-wave--${size} widget-audio-wave--${tone}${
        count === 7 ? ' widget-audio-wave--stream' : ''
      }${stateClass}`}
      aria-hidden
    >
      {Array.from({ length: count }, (_, i) => (
        <span key={i} />
      ))}
    </span>
  )
}
