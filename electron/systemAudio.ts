import { app } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import { getSystemAudioCaptureMode } from './audioPreferences'

let helperProcess: ChildProcess | null = null
let audioBuffer: Buffer[] = []
let onWavCallback: ((buffer: Buffer) => void) | null = null
let onPcmCallback: ((pcm: Buffer) => void) | null = null
let flushTimer: NodeJS.Timeout | null = null
let silenceCheckTimer: NodeJS.Timeout | null = null
let hadSpeechInBuffer = false
let lastSpeechAt = 0
let flushIntervalMs = 1000

const FLUSH_MIN_PCM_BYTES_BATCH = 12_800
/** ~200ms of mono 16-bit @ 16 kHz */
const FLUSH_MIN_PCM_BYTES_STREAM = 6400
const SILENCE_FLUSH_MS = 500
const SILENCE_RMS = 0.004
export const SYSTEM_AUDIO_SAMPLE_RATE = 16000
const CHANNELS = 1
const BIT_DEPTH = 16

export type SystemAudioHandlers = {
  /** Called with WAV frames (legacy / recording / batch STT). */
  onWav?: (wavBuffer: Buffer) => void
  /** Called with raw PCM frames for live streaming STT. */
  onPcm?: (pcm: Buffer) => void
  /** Flush cadence. Use ~200 for Deepgram live; ~1000 for batch. */
  flushIntervalMs?: number
}

function pcmRms(pcm: Buffer): number {
  if (pcm.length < 4) return 0
  let sumSquares = 0
  const sampleCount = Math.floor(pcm.length / 2)
  for (let i = 0; i + 1 < pcm.length; i += 2) {
    const sample = pcm.readInt16LE(i) / 32768
    sumSquares += sample * sample
  }
  return Math.sqrt(sumSquares / sampleCount)
}

function minFlushBytes(): number {
  return onPcmCallback ? FLUSH_MIN_PCM_BYTES_STREAM : FLUSH_MIN_PCM_BYTES_BATCH
}

function flushBuffer(force = false): void {
  if (audioBuffer.length === 0) return
  if (!onWavCallback && !onPcmCallback) return

  const combined = Buffer.concat(audioBuffer)
  if (!force && combined.length < minFlushBytes()) return

  audioBuffer = []
  hadSpeechInBuffer = false

  if (onPcmCallback) {
    onPcmCallback(combined)
  }
  if (onWavCallback) {
    onWavCallback(addWavHeader(combined, SYSTEM_AUDIO_SAMPLE_RATE, CHANNELS, BIT_DEPTH))
  }
}

function notePcmEnergy(pcm: Buffer): void {
  const rms = pcmRms(pcm)
  if (rms >= SILENCE_RMS) {
    hadSpeechInBuffer = true
    lastSpeechAt = Date.now()
  }
}

function maybeFlushOnSilence(): void {
  if (!hadSpeechInBuffer || audioBuffer.length === 0) return
  const combined = Buffer.concat(audioBuffer)
  if (combined.length < minFlushBytes()) return
  if (Date.now() - lastSpeechAt < SILENCE_FLUSH_MS) return
  flushBuffer(true)
}

export function startSystemAudio(
  onDataOrHandlers: ((buffer: Buffer) => void) | SystemAudioHandlers,
): boolean {
  if (process.platform !== 'darwin') return false

  const helperPath = app.isPackaged
    ? path.join(process.resourcesPath, 'audio-capture-helper')
    : path.join(process.cwd(), 'resources', 'audio-capture-helper')

  if (!fs.existsSync(helperPath)) {
    console.error('Audio helper not found at:', helperPath)
    return false
  }

  if (typeof onDataOrHandlers === 'function') {
    onWavCallback = onDataOrHandlers
    onPcmCallback = null
    flushIntervalMs = 1000
  } else {
    onWavCallback = onDataOrHandlers.onWav ?? null
    onPcmCallback = onDataOrHandlers.onPcm ?? null
    flushIntervalMs = onDataOrHandlers.flushIntervalMs ?? (onPcmCallback ? 200 : 1000)
  }

  hadSpeechInBuffer = false
  lastSpeechAt = 0
  const captureMode = getSystemAudioCaptureMode()

  helperProcess = spawn(helperPath, [captureMode], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  helperProcess.stderr?.on('data', (data: Buffer) => {
    console.log('Audio helper:', data.toString())
  })

  helperProcess.stdout?.on('data', (chunk: Buffer) => {
    audioBuffer.push(chunk)
    notePcmEnergy(chunk)
    maybeFlushOnSilence()
  })

  helperProcess.on('error', (err) => {
    console.error('Helper error:', err)
  })

  flushTimer = setInterval(() => {
    flushBuffer(true)
  }, flushIntervalMs)

  silenceCheckTimer = setInterval(maybeFlushOnSilence, 100)

  return true
}

export function stopSystemAudio(): void {
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
  if (silenceCheckTimer) {
    clearInterval(silenceCheckTimer)
    silenceCheckTimer = null
  }
  flushBuffer(true)
  if (helperProcess) {
    helperProcess.kill()
    helperProcess = null
  }
  audioBuffer = []
  onWavCallback = null
  onPcmCallback = null
  hadSpeechInBuffer = false
  lastSpeechAt = 0
  flushIntervalMs = 1000
}

function addWavHeader(
  audioData: Buffer,
  sampleRate: number,
  channels: number,
  bitDepth: number,
): Buffer {
  const header = Buffer.alloc(44)
  const dataSize = audioData.length
  const byteRate = (sampleRate * channels * bitDepth) / 8
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE((channels * bitDepth) / 8, 32)
  header.writeUInt16LE(bitDepth, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)
  return Buffer.concat([header, audioData])
}
