type AudioSessionWaveformProps = {
  active: boolean
  size?: 'sm' | 'md'
}

export function AudioSessionWaveform({ active, size = 'sm' }: AudioSessionWaveformProps) {
  return (
    <span
      className={`widget-audio-wave widget-audio-wave--${size}${active ? ' is-active' : ''}`}
      aria-hidden
    >
      <span />
      <span />
      <span />
      <span />
    </span>
  )
}
