import { app } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import { getSystemAudioCaptureMode } from './audioPreferences'

let helperProcess: ChildProcess | null = null
let audioBuffer: Buffer[] = []
let onDataCallback: ((buffer: Buffer) => void) | null = null
let flushTimer: NodeJS.Timeout | null = null
let silenceCheckTimer: NodeJS.Timeout | null = null
let hadSpeechInBuffer = false
let lastSpeechAt = 0

const FLUSH_INTERVAL_MS = 1000
const FLUSH_MIN_PCM_BYTES = 12_800
const SILENCE_FLUSH_MS = 500
const SILENCE_RMS = 0.004
const SAMPLE_RATE = 16000
const CHANNELS = 1
const BIT_DEPTH = 16

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

function flushBuffer(force = false): void {
  if (audioBuffer.length === 0 || !onDataCallback) return

  const combined = Buffer.concat(audioBuffer)
  if (!force && combined.length < FLUSH_MIN_PCM_BYTES) return

  audioBuffer = []
  hadSpeechInBuffer = false
  onDataCallback(addWavHeader(combined, SAMPLE_RATE, CHANNELS, BIT_DEPTH))
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
  if (combined.length < FLUSH_MIN_PCM_BYTES) return
  if (Date.now() - lastSpeechAt < SILENCE_FLUSH_MS) return
  flushBuffer(true)
}

export function startSystemAudio(onData: (buffer: Buffer) => void): boolean {
  if (process.platform !== 'darwin') return false

  const helperPath = app.isPackaged
    ? path.join(process.resourcesPath, 'audio-capture-helper')
    : path.join(process.cwd(), 'resources', 'audio-capture-helper')

  if (!fs.existsSync(helperPath)) {
    console.error('Audio helper not found at:', helperPath)
    return false
  }

  onDataCallback = onData
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
  }, FLUSH_INTERVAL_MS)

  silenceCheckTimer = setInterval(maybeFlushOnSilence, 200)

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
  if (helperProcess) {
    helperProcess.kill()
    helperProcess = null
  }
  audioBuffer = []
  onDataCallback = null
  hadSpeechInBuffer = false
  lastSpeechAt = 0
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
