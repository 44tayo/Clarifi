import WebSocket from 'ws'

import { getTranscriptionLanguage } from './audioPreferences'
import { getDeepgramApiBaseUrl, getDeepgramApiKey } from './keys'
import {
  isLikelyHallucination,
  normalizeTranscriptText,
  type TranscriptSource,
} from './transcriptUtils'

export type LiveFinalUtterance = {
  text: string
  speaker: string
  deepgramIndex: number
  /** Approx start within the live stream (ms from session open). */
  streamOffsetMs: number
}

export type LiveInterimUpdate = {
  text: string
  speaker: string
}

export type LiveSpeakerState = {
  map: Array<[number, string]>
  nextSpeakerNumber: number
}

type DeepgramLiveOptions = {
  diarize: boolean
  /** Which transcript source this session represents — used for source-tuned hallucination checks. */
  source: TranscriptSource
  /** Label to use for non-diarized finals (e.g. 'Me' for the mic session). Defaults to 'Them'. */
  fixedSpeakerLabel?: string
  /** Restore Speaker N mapping after pause/resume so labels stay stable. */
  initialSpeakerState?: LiveSpeakerState
  onFinal: (utterance: LiveFinalUtterance) => void
  /**
   * Fired for in-progress (non-final) results so the UI can show a live
   * "typing" caption. Best-effort speaker guess only — never hallucination
   * filtered since it's transient and always superseded by onFinal.
   */
  onInterim?: (update: LiveInterimUpdate) => void
  onOpen?: () => void
  onError?: (message: string) => void
  onClose?: () => void
}

type DgWord = {
  word?: string
  punctuated_word?: string
  speaker?: number
  start?: number
  end?: number
}

type DgMessage = {
  type?: string
  is_final?: boolean
  speech_final?: boolean
  start?: number
  duration?: number
  channel?: {
    alternatives?: Array<{
      transcript?: string
      words?: DgWord[]
    }>
  }
}

const SAMPLE_RATE = 16000

function wsBaseUrl(): string {
  const http = getDeepgramApiBaseUrl().replace(/\/$/, '')
  if (http.startsWith('https://')) return `wss://${http.slice('https://'.length)}`
  if (http.startsWith('http://')) return `ws://${http.slice('http://'.length)}`
  return 'wss://api.deepgram.com'
}

function buildListenUrl(diarize: boolean): string {
  const language = getTranscriptionLanguage()
  const params = new URLSearchParams({
    model: 'nova-3',
    punctuate: 'true',
    smart_format: 'true',
    interim_results: 'true',
    encoding: 'linear16',
    sample_rate: String(SAMPLE_RATE),
    channels: '1',
    endpointing: '300',
    utterance_end_ms: '1000',
    vad_events: 'true',
    mip_opt_out: 'true',
    filler_words: 'true',
  })
  if (diarize) {
    params.set('diarize_model', 'latest')
  }
  if (language && language !== 'auto') {
    params.set('language', language)
  } else {
    // Streaming language detect is model-dependent; default English for live meetings.
    params.set('language', 'en')
  }
  return `${wsBaseUrl()}/v1/listen?${params.toString()}`
}

export class DeepgramLiveSession {
  private socket: WebSocket | null = null
  private keepAliveTimer: NodeJS.Timeout | null = null
  private speakerMap = new Map<number, string>()
  private nextSpeakerNumber = 1
  private openedAt = 0
  private closed = false
  private readonly options: DeepgramLiveOptions

  constructor(options: DeepgramLiveOptions) {
    this.options = options
    const initial = options.initialSpeakerState
    if (initial) {
      this.speakerMap = new Map(initial.map)
      this.nextSpeakerNumber = Math.max(1, initial.nextSpeakerNumber)
    }
  }

  get isOpen(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }

  getSpeakerState(): LiveSpeakerState {
    return {
      map: [...this.speakerMap.entries()],
      nextSpeakerNumber: this.nextSpeakerNumber,
    }
  }

  async start(): Promise<boolean> {
    const apiKey = await getDeepgramApiKey()
    if (!apiKey) {
      this.options.onError?.('Deepgram API key not configured')
      return false
    }

    const url = buildListenUrl(this.options.diarize)
    console.log('Deepgram live connecting:', url.replace(/Token=[^&]+/g, 'Token=***'))

    return await new Promise<boolean>((resolve) => {
      let settled = false
      const socket = new WebSocket(url, {
        headers: { Authorization: `Token ${apiKey}` },
      })
      this.socket = socket

      const finish = (ok: boolean) => {
        if (settled) return
        settled = true
        resolve(ok)
      }

      socket.on('open', () => {
        this.openedAt = Date.now()
        this.keepAliveTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'KeepAlive' }))
          }
        }, 8000)
        console.log('Deepgram live open (nova-3)')
        this.options.onOpen?.()
        finish(true)
      })

      socket.on('message', (data) => {
        this.handleMessage(data.toString())
      })

      socket.on('error', (err) => {
        console.error('Deepgram live error:', err)
        this.options.onError?.(err instanceof Error ? err.message : String(err))
        finish(false)
      })

      socket.on('close', () => {
        this.clearKeepAlive()
        this.options.onClose?.()
        finish(false)
      })

      setTimeout(() => {
        if (!settled && socket.readyState !== WebSocket.OPEN) {
          console.error('Deepgram live connect timeout')
          try {
            socket.close()
          } catch {
            // ignore
          }
          finish(false)
        }
      }, 8000)
    })
  }

  sendPcm(pcm: Buffer): void {
    if (!pcm.length || !this.socket || this.socket.readyState !== WebSocket.OPEN) return
    this.socket.send(pcm)
  }

  stop(): void {
    if (this.closed) return
    this.closed = true
    this.clearKeepAlive()
    const socket = this.socket
    this.socket = null
    if (!socket) return
    try {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'CloseStream' }))
      }
      socket.close()
    } catch {
      // ignore
    }
  }

  private clearKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = null
    }
  }

  private stableSpeaker(index: number): string {
    if (!this.options.diarize) return this.options.fixedSpeakerLabel ?? 'Them'
    const existing = this.speakerMap.get(index)
    if (existing) return existing
    const label = `Speaker ${this.nextSpeakerNumber}`
    this.nextSpeakerNumber += 1
    this.speakerMap.set(index, label)
    return label
  }

  private handleMessage(raw: string): void {
    let message: DgMessage
    try {
      message = JSON.parse(raw) as DgMessage
    } catch {
      return
    }

    if (message.type && message.type !== 'Results') return

    if (!message.is_final && !message.speech_final) {
      const interimAlt = message.channel?.alternatives?.[0]
      const interimText = normalizeTranscriptText(interimAlt?.transcript ?? '')
      if (!interimText || !this.options.onInterim) return
      const guessIndex = typeof interimAlt?.words?.[0]?.speaker === 'number' ? interimAlt.words[0]!.speaker! : 0
      this.options.onInterim({
        text: interimText,
        speaker: this.stableSpeaker(guessIndex),
      })
      return
    }

    const alt = message.channel?.alternatives?.[0]
    const transcript = normalizeTranscriptText(alt?.transcript ?? '')
    if (!transcript) return
    if (isLikelyHallucination(transcript, this.options.source, { trusted: true })) {
      console.warn('Deepgram live: dropped as hallucination/garbage:', JSON.stringify(transcript))
      return
    }

    const words = alt?.words ?? []
    const streamOffsetMs = Math.max(
      0,
      typeof message.start === 'number' ? Math.round(message.start * 1000) : Date.now() - this.openedAt,
    )

    if (!this.options.diarize || words.length === 0) {
      this.options.onFinal({
        text: transcript,
        speaker: this.stableSpeaker(0),
        deepgramIndex: 0,
        streamOffsetMs,
      })
      return
    }

    // Split final result into contiguous speaker runs for accurate Speaker N labels.
    let currentIndex = typeof words[0]?.speaker === 'number' ? words[0]!.speaker! : 0
    let parts: string[] = []
    let runStart =
      typeof words[0]?.start === 'number' ? Math.round(words[0]!.start! * 1000) : streamOffsetMs

    const flush = () => {
      const text = normalizeTranscriptText(parts.join(' '))
      if (!text) return
      if (isLikelyHallucination(text, this.options.source, { trusted: true })) {
        console.warn('Deepgram live: dropped speaker-run as hallucination/garbage:', JSON.stringify(text))
        return
      }
      this.options.onFinal({
        text,
        speaker: this.stableSpeaker(currentIndex),
        deepgramIndex: currentIndex,
        streamOffsetMs: runStart,
      })
    }

    // Debounce single-word diarization flips: only treat a speaker change as
    // real once the new speaker persists for 2 consecutive words. A lone
    // differing word is folded back into the current run instead of becoming
    // its own short-lived run — short runs are exactly what real speech
    // fragments look like, so fragmenting on every blip both misattributes
    // speakers and increases the odds a real 2-3 word utterance gets treated
    // as noise downstream.
    let pendingIndex: number | null = null
    let pendingTokens: string[] = []
    let pendingStart = 0

    const foldPendingIntoCurrent = () => {
      if (pendingTokens.length === 0) return
      parts.push(...pendingTokens)
      pendingIndex = null
      pendingTokens = []
    }

    const commitPending = () => {
      flush()
      parts = pendingTokens
      currentIndex = pendingIndex!
      runStart = pendingStart
      pendingIndex = null
      pendingTokens = []
    }

    for (const word of words) {
      const nextIndex = typeof word.speaker === 'number' ? word.speaker : currentIndex
      const token = word.punctuated_word ?? word.word ?? ''
      if (!token) continue
      const wordStart =
        typeof word.start === 'number' ? Math.round(word.start * 1000) : streamOffsetMs

      if (nextIndex === currentIndex) {
        foldPendingIntoCurrent()
        parts.push(token)
        continue
      }

      if (pendingIndex === nextIndex) {
        pendingTokens.push(token)
        commitPending()
        continue
      }

      foldPendingIntoCurrent()
      pendingIndex = nextIndex
      pendingTokens = [token]
      pendingStart = wordStart
    }

    // A trailing unconfirmed candidate at the end of the final result can't
    // be debounced further — keep it attached to the current speaker rather
    // than risk an orphan one-word run.
    foldPendingIntoCurrent()
    if (parts.length > 0) flush()
  }
}

export function pcmToWavBuffer(pcm: Buffer, sampleRate = SAMPLE_RATE): Buffer {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}
