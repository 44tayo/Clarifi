let audioContext: AudioContext | null = null

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

function playTone(frequency: number, durationSec: number, volume = 0.14): void {
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

/** Soft upward click when dictation recording starts. */
export function playDictationStartSound(): void {
  playTone(880, 0.045, 0.13)
  window.setTimeout(() => playTone(1180, 0.035, 0.09), 40)
}

/** Satisfying two-tone click when recording finishes. */
export function playDictationFinishSound(): void {
  playTone(740, 0.05, 0.12)
  window.setTimeout(() => playTone(980, 0.04, 0.1), 55)
}
