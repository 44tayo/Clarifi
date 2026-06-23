let audioContext: AudioContext | null = null
let uiSoundsEnabled = true

export function setUiSoundsEnabled(enabled: boolean): void {
  uiSoundsEnabled = enabled
}

function getAudioContext(): AudioContext | null {
  try {
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new AudioContext()
    }
    if (audioContext.state === 'suspended') {
      void audioContext.resume()
    }
    return audioContext
  } catch {
    return null
  }
}

function playTone(frequency: number, durationSec: number, volume = 0.1): void {
  if (!uiSoundsEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(frequency, ctx.currentTime)
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + durationSec)
}

/** Short click for buttons and controls. */
export function playUiClick(): void {
  playTone(620, 0.028, 0.09)
}

/** Brighter two-tone for toggles and mode switches. */
export function playUiToggle(): void {
  playTone(720, 0.03, 0.1)
  window.setTimeout(() => playTone(960, 0.025, 0.08), 35)
}

/** Subtle tick when grabbing resize handles. */
export function playUiDrag(): void {
  playTone(480, 0.02, 0.06)
}
