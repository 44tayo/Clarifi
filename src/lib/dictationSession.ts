import {
  playDictationFinishSound,
  playDictationStartSound,
} from './dictationSounds'

export type DictationSessionState = 'idle' | 'recording' | 'processing'

export type DictationTargetSnapshot = {
  app: string
  displayId: number
  windowTitle?: string
  fieldPreview?: string
  cursor?: { x: number; y: number }
}

export type DictationComposeResult = {
  text?: string
  error?: string
  destination?: 'overlay' | 'focused_field'
  targetApp?: string | null
  surfaceLabel?: string
  clipboardFallback?: boolean
}

export type DictationSessionCallbacks = {
  onStateChange: (state: DictationSessionState) => void
  onStatus?: (message: string, durationMs?: number) => void
}

const MIN_DICTATION_BLOB_BYTES = 1_200

/** Voice-activity thresholds used to detect "nothing was said" before any upload. */
const VAD_RMS_THRESHOLD = 0.012
const VAD_PEAK_MIN = 0.025
const VAD_MIN_VOICED_MS = 280
/**
 * If the measured peak is below this, the analyser never actually received audio
 * (e.g. a suspended AudioContext) — we treat the reading as unmeasured and fall
 * back to the server-side speech check instead of falsely rejecting the clip.
 */
const VAD_DEAD_PEAK_EPSILON = 1e-4
/** Auto-gain: boost clips whose peak is below this toward the target peak. */
const AUTO_GAIN_LOW_PEAK = 0.08
const AUTO_GAIN_TARGET_PEAK = 0.5
const AUTO_GAIN_MAX = 8

type VadStats = {
  peak: number
  voicedMs: number
  durationMs: number
  /** False when the Web Audio meter never started (so callers must not gate on it). */
  valid: boolean
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, chunk as unknown as number[])
  }
  return btoa(binary)
}

const WAV_TARGET_RATE = 16_000

function resampleMono(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || samples.length === 0) return samples
  const ratio = toRate / fromRate
  const outLength = Math.max(1, Math.round(samples.length * ratio))
  const out = new Float32Array(outLength)
  for (let i = 0; i < outLength; i += 1) {
    const srcPos = i / ratio
    const idx = Math.floor(srcPos)
    const frac = srcPos - idx
    const a = samples[idx] ?? 0
    const b = samples[idx + 1] ?? a
    out[i] = a + (b - a) * frac
  }
  return out
}

function encodeWavMono16(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
    offset += bytesPerSample
  }
  return buffer
}

/**
 * When a clip is quiet, decode it, apply makeup gain, and re-encode as 16 kHz WAV.
 * Returns null when no boost is needed or decoding fails (caller keeps the webm).
 */
async function maybeAutoGainToWav(
  blob: Blob,
  measuredPeak: number,
): Promise<{ base64: string; format: 'wav' } | null> {
  if (measuredPeak <= 0 || measuredPeak >= AUTO_GAIN_LOW_PEAK) return null

  const AudioCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtor) return null

  let context: AudioContext | null = null
  try {
    context = new AudioCtor()
    const decoded = await context.decodeAudioData(await blob.arrayBuffer())

    const channelCount = decoded.numberOfChannels
    const length = decoded.length
    const mono = new Float32Array(length)
    for (let ch = 0; ch < channelCount; ch += 1) {
      const data = decoded.getChannelData(ch)
      for (let i = 0; i < length; i += 1) mono[i] += data[i] / channelCount
    }

    let peak = 0
    for (let i = 0; i < mono.length; i += 1) {
      const abs = Math.abs(mono[i])
      if (abs > peak) peak = abs
    }
    if (peak <= 0) return null

    const gain = Math.min(AUTO_GAIN_MAX, Math.max(1, AUTO_GAIN_TARGET_PEAK / peak))
    if (gain > 1) {
      for (let i = 0; i < mono.length; i += 1) mono[i] *= gain
    }

    const resampled = resampleMono(mono, decoded.sampleRate, WAV_TARGET_RATE)
    const wav = encodeWavMono16(resampled, WAV_TARGET_RATE)
    return { base64: arrayBufferToBase64(wav), format: 'wav' }
  } catch {
    return null
  } finally {
    try {
      await context?.close()
    } catch {
      // ignore
    }
  }
}

async function getDictationMicStream(preferredDeviceId?: string): Promise<MediaStream> {
  const audioConstraints = (deviceId?: string): MediaTrackConstraints => ({
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  })

  if (preferredDeviceId) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints(preferredDeviceId),
      })
    } catch {
      // Preferred mic unavailable — fall back to system default
    }
  }

  return navigator.mediaDevices.getUserMedia({ audio: audioConstraints() })
}

function showStatus(
  callbacks: DictationSessionCallbacks,
  message: string,
  durationMs = 2500,
): void {
  callbacks.onStatus?.(message, durationMs)
}

type SessionBootstrap = {
  connected?: boolean
  preferredMicId?: string | null
  targetApp?: string | null
}

export class DictationSession {
  private state: DictationSessionState = 'idle'
  private recorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private warmStream: MediaStream | null = null
  private warmDeviceId: string | undefined
  private warmPromise: Promise<void> | null = null
  private chunks: Blob[] = []
  private mimeType = 'audio/webm;codecs=opus'
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private analyserSource: MediaStreamAudioSourceNode | null = null
  private vadTimer: number | null = null
  private vadPeak = 0
  private vadVoicedMs = 0
  private vadStarted = false
  private vadSampleBuffer: Float32Array<ArrayBuffer> | null = null
  private recordStartedAt = 0
  private targetApp: string | null = null
  private targetSnapshot: DictationTargetSnapshot | null = null
  private connected = false
  private preferredMicId: string | undefined
  private readonly callbacks: DictationSessionCallbacks

  constructor(callbacks: DictationSessionCallbacks) {
    this.callbacks = callbacks
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      this.mimeType = 'audio/webm;codecs=opus'
    } else {
      this.mimeType = 'audio/webm'
    }
  }

  getState(): DictationSessionState {
    return this.state
  }

  /** Pre-fetch session data and keep the mic warm so Fn-hold starts instantly. */
  prepare(): void {
    void this.refreshSessionCache(false)
    void this.ensureWarmStream()
  }

  private setState(next: DictationSessionState): void {
    this.state = next
    this.callbacks.onStateChange(next)
  }

  private stopCapture(): void {
    if (this.vadTimer !== null || this.audioContext) {
      this.teardownVadMonitor()
    }
    this.recorder = null
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    this.chunks = []
  }

  private releaseWarmStream(): void {
    this.warmStream?.getTracks().forEach((track) => track.stop())
    this.warmStream = null
    this.warmDeviceId = undefined
  }

  private applyBootstrap(data: SessionBootstrap): void {
    this.connected = Boolean(data.connected)
    const nextMicId = data.preferredMicId?.trim() || undefined
    if (nextMicId !== this.preferredMicId) {
      this.preferredMicId = nextMicId
      this.releaseWarmStream()
    }
    if (data.targetApp !== undefined) {
      this.targetApp = data.targetApp
    }
  }

  private async refreshSessionCache(refreshPairing = false): Promise<void> {
    try {
      const data = (await window.electronAPI.invoke('dictation:session-bootstrap', {
        refreshPairing,
      })) as SessionBootstrap
      this.applyBootstrap(data)
    } catch {
      // Keep last-known cache on transient IPC errors.
    }
  }

  private async ensureWarmStream(): Promise<void> {
    if (this.state !== 'idle') return
    if (this.warmStream && this.warmDeviceId === this.preferredMicId) return
    if (this.warmPromise) return this.warmPromise

    this.warmPromise = (async () => {
      try {
        this.releaseWarmStream()
        const stream = await getDictationMicStream(this.preferredMicId)
        if (this.state !== 'idle') {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        this.warmStream = stream
        this.warmDeviceId = this.preferredMicId
      } catch {
        this.releaseWarmStream()
      } finally {
        this.warmPromise = null
      }
    })()

    return this.warmPromise
  }

  private scheduleRewarm(): void {
    void this.ensureWarmStream()
  }

  private beginRecording(stream: MediaStream): void {
    this.stream = stream
    this.chunks = []

    const recorder = new MediaRecorder(stream, { mimeType: this.mimeType })
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data)
    }
    recorder.start(250)
    this.recorder = recorder
    this.startVadMonitor(stream)
    this.setState('recording')
    playDictationStartSound()
  }

  /** Lightweight live voice-activity tracking so silent clips never reach the network. */
  private startVadMonitor(stream: MediaStream): void {
    this.vadPeak = 0
    this.vadVoicedMs = 0
    this.vadStarted = false
    this.recordStartedAt = performance.now()
    try {
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioCtor) return
      const context = new AudioCtor()
      // A fresh AudioContext often starts "suspended" (autoplay policy); without
      // resuming it the analyser reads pure silence and the VAD falsely reports
      // "no speech" even while the user is talking.
      if (context.state === 'suspended') {
        void context.resume().catch(() => {})
      }
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      const buffer = new Float32Array(analyser.fftSize)
      this.audioContext = context
      this.analyser = analyser
      this.analyserSource = source
      this.vadSampleBuffer = buffer

      const intervalMs = 50
      this.vadTimer = window.setInterval(() => {
        if (!this.analyser || !this.vadSampleBuffer) return
        this.analyser.getFloatTimeDomainData(this.vadSampleBuffer)
        let sumSquares = 0
        let peak = 0
        for (let i = 0; i < this.vadSampleBuffer.length; i += 1) {
          const sample = this.vadSampleBuffer[i]
          sumSquares += sample * sample
          const abs = Math.abs(sample)
          if (abs > peak) peak = abs
        }
        const rms = Math.sqrt(sumSquares / this.vadSampleBuffer.length)
        if (peak > this.vadPeak) this.vadPeak = peak
        if (rms >= VAD_RMS_THRESHOLD) this.vadVoicedMs += intervalMs
      }, intervalMs)
      this.vadStarted = true
    } catch {
      this.teardownVadMonitor()
    }
  }

  private teardownVadMonitor(): VadStats {
    const durationMs = this.recordStartedAt > 0 ? performance.now() - this.recordStartedAt : 0
    if (this.vadTimer !== null) {
      window.clearInterval(this.vadTimer)
      this.vadTimer = null
    }
    try {
      this.analyserSource?.disconnect()
      this.analyser?.disconnect()
      void this.audioContext?.close()
    } catch {
      // Best-effort teardown.
    }
    const stats: VadStats = {
      peak: this.vadPeak,
      voicedMs: this.vadVoicedMs,
      durationMs,
      // Only trust the meter if it actually received signal; a dead-zero peak
      // means it never ran, so callers must fall back to server-side checks.
      valid: this.vadStarted && this.vadPeak > VAD_DEAD_PEAK_EPSILON,
    }
    this.analyserSource = null
    this.analyser = null
    this.audioContext = null
    this.vadSampleBuffer = null
    this.vadStarted = false
    return stats
  }

  private hasSpeech(stats: VadStats): boolean {
    // Never gate on stats we couldn't measure — fall back to server-side checks.
    if (!stats.valid) return true
    return stats.peak >= VAD_PEAK_MIN && stats.voicedMs >= VAD_MIN_VOICED_MS
  }

  private applySnapshot(snapshot: DictationTargetSnapshot | null | undefined): void {
    this.targetSnapshot = snapshot ?? null
    if (snapshot?.app) {
      this.targetApp = snapshot.app
    }
  }

  async start(
    options: {
      blocked?: boolean
      blockedReason?: string
      snapshot?: DictationTargetSnapshot | null
    } = {},
  ): Promise<boolean> {
    if (this.state !== 'idle') return false
    if (options.blocked) {
      showStatus(this.callbacks, options.blockedReason ?? 'Dictation unavailable right now')
      return false
    }

    if (options.snapshot !== undefined) {
      this.applySnapshot(options.snapshot)
    }

    if (!this.connected) {
      await this.refreshSessionCache(true)
    }
    if (!this.connected) {
      showStatus(this.callbacks, 'Connect your account on the website first')
      return false
    }

    if (!this.targetSnapshot && !options.snapshot) {
      try {
        const captured = (await window.electronAPI.invoke('dictation:capture-target')) as
          | DictationTargetSnapshot
          | null
        this.applySnapshot(captured)
      } catch {
        // Fall back to cached targetApp from bootstrap.
      }
    }

    try {
      let stream = this.warmStream
      if (stream) {
        this.warmStream = null
        this.warmDeviceId = undefined
      } else {
        stream = await getDictationMicStream(this.preferredMicId)
      }

      this.beginRecording(stream)
      void this.ensureWarmStream()
      return true
    } catch (err) {
      console.error('Dictation mic error:', err)
      this.stopCapture()
      this.setState('idle')
      showStatus(this.callbacks, 'Microphone access denied — check System Settings')
      void this.ensureWarmStream()
      return false
    }
  }

  cancel(): void {
    if (this.state !== 'recording') return
    const recorder = this.recorder
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch {
        // ignore
      }
    }
    this.stopCapture()
    this.targetSnapshot = null
    this.setState('idle')
    void window.electronAPI.invoke('dictation:session-idle')
    this.scheduleRewarm()
  }

  async finish(): Promise<void> {
    if (this.state !== 'recording') return

    const recorder = this.recorder
    if (!recorder || recorder.state === 'inactive') {
      this.stopCapture()
      this.targetSnapshot = null
      this.setState('idle')
      void window.electronAPI.invoke('dictation:session-idle')
      this.scheduleRewarm()
      return
    }

    this.setState('processing')
    playDictationFinishSound()

    const blob = await new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        resolve(this.chunks.length > 0 ? new Blob(this.chunks, { type: this.mimeType }) : null)
      }
      try {
        recorder.stop()
      } catch {
        resolve(null)
      }
    })

    const vadStats = this.teardownVadMonitor()
    this.stopCapture()

    if (!blob || blob.size < MIN_DICTATION_BLOB_BYTES) {
      this.targetSnapshot = null
      this.setState('idle')
      showStatus(this.callbacks, 'Speak a bit longer, then try again')
      void window.electronAPI.invoke('dictation:session-idle')
      this.scheduleRewarm()
      return
    }

    // Local no-speech short-circuit: skip the network round-trip when silent.
    if (!this.hasSpeech(vadStats)) {
      this.targetSnapshot = null
      this.setState('idle')
      showStatus(this.callbacks, 'No speech detected — try again')
      void window.electronAPI.invoke('dictation:session-idle')
      this.scheduleRewarm()
      return
    }

    try {
      const gained = await maybeAutoGainToWav(blob, vadStats.peak)
      const base64 = gained?.base64 ?? arrayBufferToBase64(await blob.arrayBuffer())
      const result = (await window.electronAPI.invoke('dictation:compose', {
        audioBase64: base64,
        durationMs: Math.round(vadStats.durationMs),
        hasSpeech: vadStats.valid ? true : undefined,
        target: 'auto',
        targetApp: this.targetApp,
        targetSnapshot: this.targetSnapshot,
      })) as DictationComposeResult

      const pasteHint = navigator.platform.toLowerCase().includes('win') ? 'Ctrl+V' : '⌘V'

      if (result.error === 'no_speech') {
        showStatus(this.callbacks, 'No speech detected — try again')
      } else if (result.error === 'plan_required') {
        showStatus(this.callbacks, 'Start a 7-day free trial to use voice dictation', 4000)
      } else if (result.destination === 'focused_field' && result.text) {
        const appLabel = result.targetApp?.split(' ')[0] ?? result.surfaceLabel ?? 'your app'
        showStatus(this.callbacks, `Dictation inserted into ${appLabel}`, 2500)
      } else if (result.error === 'accessibility_required') {
        showStatus(
          this.callbacks,
          'Enable Accessibility for Clarifi to dictate into other apps',
          4000,
        )
      } else if (result.clipboardFallback && result.text) {
        showStatus(this.callbacks, `Copied to clipboard — paste with ${pasteHint}`, 3000)
      } else if (result.error === 'insert_failed') {
        showStatus(this.callbacks, 'Could not insert — text copied if available')
      } else if (result.text) {
        showStatus(this.callbacks, 'Dictation complete', 1500)
      }
    } catch (err) {
      console.error('Dictation error:', err)
      showStatus(this.callbacks, 'Dictation failed — try again')
    } finally {
      this.targetSnapshot = null
      this.setState('idle')
      void window.electronAPI.invoke('dictation:session-idle')
      void this.refreshSessionCache(false)
      this.scheduleRewarm()
    }
  }
}
