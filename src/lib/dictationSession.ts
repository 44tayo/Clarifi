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
    this.setState('recording')
    playDictationStartSound()
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

    this.stopCapture()

    if (!blob || blob.size < MIN_DICTATION_BLOB_BYTES) {
      this.targetSnapshot = null
      this.setState('idle')
      showStatus(this.callbacks, 'Speak a bit longer, then try again')
      void window.electronAPI.invoke('dictation:session-idle')
      this.scheduleRewarm()
      return
    }

    try {
      const base64 = arrayBufferToBase64(await blob.arrayBuffer())
      const result = (await window.electronAPI.invoke('dictation:compose', {
        audioBase64: base64,
        target: 'auto',
        targetApp: this.targetApp,
      })) as DictationComposeResult

      const pasteHint = navigator.platform.toLowerCase().includes('win') ? 'Ctrl+V' : '⌘V'

      if (result.error === 'no_speech') {
        showStatus(this.callbacks, 'No speech detected — try again')
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
