import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import FormData from 'form-data'
import fetch from 'node-fetch'
import { getTranscriptionLanguage } from './audioPreferences'
import { getGroqApiKey } from './keys'
import { isProxyConfigured, proxyTranscribe } from './proxyClient'
import { isTranscriptionDrainMode } from './transcriptionQueue'

let isRecording = false
let isPaused = false
let transcriptCallback: ((text: string) => void) | null = null

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
}

const MIN_WEBM_BYTES = 1_200
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
    const tmpFile = path.join(os.tmpdir(), `clarifi-${Date.now()}.${extension}`)
    fs.writeFileSync(tmpFile, audioBuffer)

    const formData = new FormData()
    formData.append('file', fs.createReadStream(tmpFile), {
      filename: `audio.${extension}`,
      contentType,
    })
    formData.append('model', 'whisper-large-v3-turbo')
    const language = getTranscriptionLanguage()
    if (language && language !== 'auto') {
      formData.append('language', language)
    }
    const prompt = options.prompt?.trim().slice(-220)
    if (prompt) {
      formData.append('prompt', prompt)
    }
    formData.append('temperature', '0')

    if (await isProxyConfigured()) {
      const transcript = await proxyTranscribe(audioBase64, format, language, prompt)
      fs.unlinkSync(tmpFile)
      if (transcript) console.log('Transcript:', transcript)
      return transcript
    }

    const groqKey = await getGroqApiKey()
    if (!groqKey) {
      console.error('Groq API key is not configured')
      fs.unlinkSync(tmpFile)
      return null
    }

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        ...formData.getHeaders(),
      },
      body: formData,
    })

    fs.unlinkSync(tmpFile)

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
  return transcribeAudioBuffer(audioBase64, options)
}
