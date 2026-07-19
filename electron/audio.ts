import FormData from 'form-data'
import fetch from 'node-fetch'
import { getTranscriptionLanguage, getDictationLanguage } from './audioPreferences'
import { groqKeepAliveAgent } from './groqHttp'
import { getGroqApiBaseUrl, getGroqApiKey } from './keys'
import { isProxyConfigured, proxyTranscribe } from './proxyClient'
import { isTranscriptionDrainMode } from './transcriptionQueue'

let isRecording = false
let isPaused = false
let transcriptCallback: ((text: string) => void) | null = null

let cachedGroqKey: string | null | undefined
let cachedProxyConfigured: boolean | undefined
let transcribeCacheExpiry = 0
const TRANSCRIBE_CACHE_MS = 60_000

export function invalidateTranscribeCache(): void {
  cachedGroqKey = undefined
  cachedProxyConfigured = undefined
  transcribeCacheExpiry = 0
}

async function getCachedProxyConfigured(): Promise<boolean> {
  const now = Date.now()
  if (cachedProxyConfigured !== undefined && now < transcribeCacheExpiry) {
    return cachedProxyConfigured
  }
  cachedProxyConfigured = await isProxyConfigured()
  transcribeCacheExpiry = now + TRANSCRIBE_CACHE_MS
  return cachedProxyConfigured
}

async function getCachedGroqKey(): Promise<string | null> {
  const now = Date.now()
  if (cachedGroqKey !== undefined && now < transcribeCacheExpiry) {
    return cachedGroqKey
  }
  cachedGroqKey = await getGroqApiKey()
  transcribeCacheExpiry = now + TRANSCRIBE_CACHE_MS
  return cachedGroqKey
}

export function startRecording(onTranscript: (text: string) => void): void {
  isRecording = true
  isPaused = false
  transcriptCallback = onTranscript
  console.log('Recording started - waiting for audio chunks from renderer')
}

export function stopRecording(): void {
  isRecording = false
  isPaused = false
  transcriptCallback = null
  console.log('Recording stopped')
}

export function pauseRecording(): void {
  if (!isRecording) return
  isPaused = true
}

export function resumeRecording(): void {
  if (!isRecording) return
  isPaused = false
}

export function getIsRecording(): boolean {
  return isRecording
}

export function getIsPaused(): boolean {
  return isPaused
}

function detectAudioFormat(buffer: Buffer): 'wav' | 'webm' {
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'RIFF') {
    return 'wav'
  }
  return 'webm'
}

export type TranscribeOptions = {
  source?: 'mic' | 'system'
  prompt?: string
  language?: string
  model?: string
}

export const MIN_WEBM_BYTES = 1_200
const MIN_WAV_BYTES = 12_800
const SYSTEM_SPEECH_RMS_MIN = 0.004

export function wavRms(buffer: Buffer): number {
  if (buffer.length < 48 || buffer.toString('ascii', 0, 4) !== 'RIFF') {
    return 0
  }

  const pcm = buffer.subarray(44)
  if (pcm.length < 4) return 0

  let sumSquares = 0
  const sampleCount = Math.floor(pcm.length / 2)
  for (let i = 0; i + 1 < pcm.length; i += 2) {
    const sample = pcm.readInt16LE(i) / 32768
    sumSquares += sample * sample
  }

  return Math.sqrt(sumSquares / sampleCount)
}

export function wavHasSpeechEnergy(buffer: Buffer, minRms = SYSTEM_SPEECH_RMS_MIN): boolean {
  if (buffer.length < 48 || buffer.toString('ascii', 0, 4) !== 'RIFF') {
    return true
  }

  return wavRms(buffer) >= minRms
}

async function transcribeAudioBuffer(
  audioBase64: string,
  options: TranscribeOptions = {},
): Promise<string | null> {
  try {
    const audioBuffer = Buffer.from(audioBase64, 'base64')
    const format = detectAudioFormat(audioBuffer)
    const minBytes = format === 'wav' ? MIN_WAV_BYTES : MIN_WEBM_BYTES
    if (audioBuffer.length < minBytes) {
      return null
    }

    if (format === 'wav' && !wavHasSpeechEnergy(audioBuffer)) {
      return null
    }

    const extension = format === 'wav' ? 'wav' : 'webm'
    const contentType = format === 'wav' ? 'audio/wav' : 'audio/webm'
    const language = options.language ?? getTranscriptionLanguage()
    const prompt = options.prompt?.trim().slice(-220)

    // Prefer a direct Groq call when a local key is available — it skips the
    // device → proxy → Groq hop and is noticeably lower latency. Fall back to the
    // proxy only when there's no local key (e.g. packaged users on the cloud key).
    const groqKey = await getCachedGroqKey()
    if (!groqKey) {
      if (await getCachedProxyConfigured()) {
        const transcript = await proxyTranscribe(
          audioBase64,
          format,
          language,
          prompt,
          options.model,
        )
        if (transcript) console.log('Transcript:', transcript)
        return transcript
      }
      console.error('Groq API key is not configured')
      return null
    }

    const formData = new FormData()
    formData.append('file', audioBuffer, {
      filename: `audio.${extension}`,
      contentType,
    })
    formData.append('model', options.model ?? 'whisper-large-v3-turbo')
    if (language && language !== 'auto') {
      formData.append('language', language)
    }
    if (prompt) {
      formData.append('prompt', prompt)
    }
    formData.append('temperature', '0')

    const response = await fetch(`${getGroqApiBaseUrl()}/openai/v1/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        ...formData.getHeaders(),
      },
      body: formData,
      agent: groqKeepAliveAgent,
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Whisper error:', err)
      return null
    }

    const data = (await response.json()) as { text: string }
    const transcript = data.text?.trim()
    console.log('Transcript:', transcript)
    return transcript || null
  } catch (err) {
    console.error('Audio processing error:', err)
    return null
  }
}

export async function processAudioChunk(
  audioBase64: string,
  options: TranscribeOptions = {},
): Promise<string | null> {
  if ((!isRecording || isPaused) && !isTranscriptionDrainMode()) return null
  return transcribeAudioBuffer(audioBase64, options)
}

/** One-shot dictation — not tied to an active audio session. */
export async function transcribeDictationAudio(
  audioBase64: string,
  options: TranscribeOptions = {},
): Promise<string | null> {
  return transcribeAudioBuffer(audioBase64, {
    ...options,
    language: options.language ?? getDictationLanguage(),
    model: options.model ?? 'whisper-large-v3-turbo',
  })
}
