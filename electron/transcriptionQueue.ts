import { randomUUID } from 'crypto'
import { mergeWavBuffers } from './wavMerge'
import { transcribeSystemWithDiarization } from './diarizeTranscribe'
import { processAudioChunk, getIsPaused, wavHasSpeechEnergy, wavRms } from './audio'
import {
  buildTranscriptionPrompt,
  isDuplicateAcrossStreams,
  isDuplicateOfRecent,
  isLikelyHallucination,
  isNearDuplicate,
  normalizeTranscriptText,
  type TranscriptEntry,
  type TranscriptSource,
} from './transcriptUtils'

export type TranscriptionActivityState = 'silent' | 'listening' | 'transcribing'

type QueuedChunk = {
  base64: string
  source: TranscriptSource
  enqueuedAt: number
  rms?: number
  /** Millisecond offset into the meeting system recording when this chunk was appended. */
  audioOffsetMs?: number
}

type TranscriptionQueueOptions = {
  onEntry: (entry: TranscriptEntry) => void
  onPruneEntries?: (entryIds: string[]) => void
  onActivity?: (state: TranscriptionActivityState) => void
  getEntries: () => TranscriptEntry[]
}

let queueMic: QueuedChunk[] = []
let queueSystem: QueuedChunk[] = []
let activeMicJobs = 0
let activeSystemJobs = 0
let draining = false
let options: TranscriptionQueueOptions | null = null

const MAX_CONCURRENT_MIC = 1
const MAX_CONCURRENT_SYSTEM = 1
const MIC_BLEED_WINDOW_MS = 25_000
const ACTIVITY_SILENCE_MS = 6000

export const MIC_SPEECH_RMS_MIN = 0.008
export const MIC_USER_SPEECH_RMS = 0.022
const MIC_USER_SPEECH_RMS_CAPTURE = 0.06
const MIC_USER_SYSTEM_RATIO = 2.5
const SYSTEM_SPEECH_RMS_MIN = 0.004

type SpeechWindow = {
  at: number
  rms: number
}

type SystemChunkWindow = {
  at: number
  rms: number
  hadEnergy: boolean
}

let recentSystemSpeech: SpeechWindow[] = []
let recentMicSpeech: SpeechWindow[] = []
let recentSystemChunks: SystemChunkWindow[] = []
const SYSTEM_DIARIZE_BUFFER_MS = 8000
const SYSTEM_DIARIZE_MIN_CHUNKS = 5

let systemDiarizeBuffer: QueuedChunk[] = []
let systemDiarizeBufferStartedAt = 0
/** Maps Deepgram's per-window speaker index → stable "Speaker N" for the session. */
let diarizeSpeakerMap = new Map<number, string>()
let nextDiarizeSpeakerNumber = 1
/** Byte/time offset of the current diarize buffer within the meeting recording. */
let systemDiarizeBufferAudioOffsetMs = 0

const SYSTEM_CAPTURE_WARMUP_MS = 3000

let systemCaptureActiveSince = 0

export function configureTranscriptionQueue(next: TranscriptionQueueOptions): void {
  options = next
}

export function clearTranscriptionQueue(): void {
  queueMic = []
  queueSystem = []
  activeMicJobs = 0
  activeSystemJobs = 0
  draining = false
  recentSystemSpeech = []
  recentMicSpeech = []
  recentSystemChunks = []
  systemCaptureActiveSince = 0
  systemDiarizeBuffer = []
  systemDiarizeBufferStartedAt = 0
  systemDiarizeBufferAudioOffsetMs = 0
  diarizeSpeakerMap = new Map()
  nextDiarizeSpeakerNumber = 1
  options?.onActivity?.('listening')
}

export function markSystemCaptureActive(): void {
  systemCaptureActiveSince = Date.now()
}

export function clearSystemCaptureActive(): void {
  systemCaptureActiveSince = 0
}

export function noteSystemAudioEnergy(rms: number, hadEnergy: boolean): void {
  const at = Date.now()
  updateSystemChunkWindow(at, rms, hadEnergy)
  if (hadEnergy) {
    recordSystemSpeech(at, rms)
  }
}

export function isTranscriptionDrainMode(): boolean {
  return draining
}

export function enqueueTranscription(
  base64: string,
  source: TranscriptSource,
  rms?: number,
  audioOffsetMs?: number,
): void {
  if (!base64 || !options || getIsPaused()) return
  const chunk: QueuedChunk = { base64, source, enqueuedAt: Date.now(), rms, audioOffsetMs }
  if (source === 'mic') {
    // Cap backlog so we don't stampede Whisper when speech is continuous.
    if (queueMic.length >= 3) {
      queueMic.shift()
    }
    queueMic.push(chunk)
    void drainMicQueue()
  } else {
    if (rms !== undefined) {
      updateSystemChunkWindow(chunk.enqueuedAt, rms, rms >= SYSTEM_SPEECH_RMS_MIN)
    }
    queueSystem.push(chunk)
    void drainSystemQueue()
  }
}

export async function flushTranscriptionQueue(): Promise<void> {
  draining = true
  if (systemDiarizeBuffer.length > 0 && options) {
    const last = systemDiarizeBuffer[systemDiarizeBuffer.length - 1]!
    await flushSystemDiarizeBuffer(last)
  }
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const busy =
      activeMicJobs > 0 ||
      activeSystemJobs > 0 ||
      queueMic.length > 0 ||
      queueSystem.length > 0
    if (!busy) break
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  draining = false
}

function recordSystemSpeech(at: number, rms: number): void {
  if (rms < SYSTEM_SPEECH_RMS_MIN) return
  recentSystemSpeech.push({ at, rms })
  if (recentSystemSpeech.length > 24) {
    recentSystemSpeech = recentSystemSpeech.slice(-24)
  }
}

function recordMicSpeech(at: number, rms: number): void {
  if (rms < MIC_SPEECH_RMS_MIN) return
  recentMicSpeech.push({ at, rms })
  if (recentMicSpeech.length > 24) {
    recentMicSpeech = recentMicSpeech.slice(-24)
  }
}

function systemSpeechOverlapsMic(at: number): boolean {
  return recentSystemSpeech.some(
    (window) => Math.abs(window.at - at) <= MIC_BLEED_WINDOW_MS,
  )
}

function updateSystemChunkWindow(at: number, rms: number, hadEnergy: boolean): void {
  const idx = recentSystemChunks.findIndex((chunk) => Math.abs(chunk.at - at) < 2000)
  const next: SystemChunkWindow = { at, rms, hadEnergy }
  if (idx >= 0) {
    recentSystemChunks[idx] = next
  } else {
    recentSystemChunks.push(next)
    if (recentSystemChunks.length > 24) {
      recentSystemChunks = recentSystemChunks.slice(-24)
    }
  }
}

function getMaxRecentSystemRms(at: number): number {
  const overlapping = recentSystemChunks.filter(
    (sys) => Math.abs(at - sys.at) <= MIC_BLEED_WINDOW_MS,
  )
  if (overlapping.length === 0) return 0
  return Math.max(...overlapping.map((sys) => sys.rms))
}

function isSystemCaptureSessionActive(at: number): boolean {
  return (
    systemCaptureActiveSince > 0 &&
    at - systemCaptureActiveSince >= SYSTEM_CAPTURE_WARMUP_MS
  )
}

function hasRecentSystemEnergy(at: number): boolean {
  if (systemSpeechOverlapsMic(at)) return true
  return recentSystemChunks.some(
    (sys) =>
      Math.abs(at - sys.at) <= MIC_BLEED_WINDOW_MS &&
      (sys.hadEnergy || sys.rms >= SYSTEM_SPEECH_RMS_MIN),
  )
}

function isClearlyUserMicSpeech(
  micRms: number,
  maxSystemRms: number,
  captureActive: boolean,
): boolean {
  if (!captureActive) {
    return micRms >= MIC_USER_SPEECH_RMS
  }

  const systemFloor = Math.max(maxSystemRms, SYSTEM_SPEECH_RMS_MIN)
  return (
    micRms >= MIC_USER_SPEECH_RMS_CAPTURE &&
    micRms >= systemFloor * MIC_USER_SYSTEM_RATIO
  )
}

function resolveMicEntryTarget(chunk: QueuedChunk): {
  speaker: string
  source: TranscriptSource
} | null {
  const micRms = chunk.rms ?? 0
  const captureActive = isSystemCaptureSessionActive(chunk.enqueuedAt)
  const maxSystemRms = getMaxRecentSystemRms(chunk.enqueuedAt)

  if (isClearlyUserMicSpeech(micRms, maxSystemRms, captureActive)) {
    return { speaker: 'Me', source: 'mic' }
  }

  // Remote audio is owned by the system stream — skip mic bleed entirely.
  if (captureActive || hasRecentSystemEnergy(chunk.enqueuedAt)) {
    return null
  }

  return { speaker: 'Me', source: 'mic' }
}

function shouldSkipMicChunkBeforeTranscribe(chunk: QueuedChunk): boolean {
  const micRms = chunk.rms ?? 0
  const captureActive = isSystemCaptureSessionActive(chunk.enqueuedAt)
  const maxSystemRms = getMaxRecentSystemRms(chunk.enqueuedAt)

  if (!captureActive && !hasRecentSystemEnergy(chunk.enqueuedAt)) return false
  return !isClearlyUserMicSpeech(micRms, maxSystemRms, captureActive)
}

function hasRecentSpeech(): boolean {
  const now = Date.now()
  const system = recentSystemSpeech.some((w) => now - w.at <= ACTIVITY_SILENCE_MS)
  const mic = recentMicSpeech.some(
    (w) => now - w.at <= ACTIVITY_SILENCE_MS && w.rms >= MIC_SPEECH_RMS_MIN,
  )
  return system || mic
}

function updateActivityState(): void {
  if (!options?.onActivity) return
  if (activeMicJobs > 0 || activeSystemJobs > 0) {
    options.onActivity('transcribing')
    return
  }
  options.onActivity(hasRecentSpeech() ? 'listening' : 'silent')
}

function pruneMicBleedFromSession(systemEntry: TranscriptEntry): void {
  if (!options?.onPruneEntries || systemEntry.source !== 'system') return

  const entries = options.getEntries()
  const toRemove = entries
    .filter((entry) => {
      if (entry.source !== 'mic') return false
      if (Math.abs(entry.at - systemEntry.at) > MIC_BLEED_WINDOW_MS) return false
      return isNearDuplicate(entry.text, systemEntry.text)
    })
    .map((entry) => entry.id)

  if (toRemove.length > 0) {
    options.onPruneEntries(toRemove)
  }
}

function pumpMicQueue(): void {
  if (!options) return
  while (queueMic.length > 0 && activeMicJobs < MAX_CONCURRENT_MIC) {
    const chunk = queueMic.shift()!
    activeMicJobs += 1
    updateActivityState()
    void processMicChunk(chunk).finally(() => {
      activeMicJobs -= 1
      updateActivityState()
      pumpMicQueue()
    })
  }
}

function pumpSystemQueue(): void {
  if (!options) return
  while (queueSystem.length > 0 && activeSystemJobs < MAX_CONCURRENT_SYSTEM) {
    const chunk = queueSystem.shift()!
    activeSystemJobs += 1
    updateActivityState()
    void processSystemChunk(chunk).finally(() => {
      activeSystemJobs -= 1
      updateActivityState()
      pumpSystemQueue()
    })
  }
}

async function drainMicQueue(): Promise<void> {
  pumpMicQueue()
}

async function drainSystemQueue(): Promise<void> {
  pumpSystemQueue()
}

function stableDiarizedSpeaker(deepgramIndex: number | undefined, fallbackLabel: string): string {
  const index = typeof deepgramIndex === 'number' ? deepgramIndex : -1
  if (index < 0) return fallbackLabel
  const existing = diarizeSpeakerMap.get(index)
  if (existing) return existing
  const label = `Speaker ${nextDiarizeSpeakerNumber}`
  nextDiarizeSpeakerNumber += 1
  diarizeSpeakerMap.set(index, label)
  return label
}

function emitEntry(
  chunk: QueuedChunk,
  text: string,
  speaker: string,
  source: TranscriptSource,
  timing?: { audioStartMs?: number; audioEndMs?: number },
  /** True when text came from Deepgram (confidence-gated) rather than Whisper. */
  trusted = false,
): void {
  if (!options) return

  const entries = options.getEntries()
  const normalized = normalizeTranscriptText(text)
  if (!normalized || isLikelyHallucination(normalized, source, { trusted })) return
  if (
    isDuplicateOfRecent(normalized, entries, 12_000, {
      speaker,
      source,
      at: chunk.enqueuedAt,
    })
  ) {
    return
  }
  if (
    source !== 'mic' &&
    isDuplicateAcrossStreams(normalized, entries, chunk.enqueuedAt, source)
  ) {
    return
  }

  const entry: TranscriptEntry = {
    id: randomUUID(),
    text: normalized,
    source,
    speaker,
    at: chunk.enqueuedAt,
    ...(typeof timing?.audioStartMs === 'number' ? { audioStartMs: timing.audioStartMs } : {}),
    ...(typeof timing?.audioEndMs === 'number' ? { audioEndMs: timing.audioEndMs } : {}),
  }

  if (source === 'system') {
    pruneMicBleedFromSession(entry)
  }

  options.onEntry(entry)
}

function shouldProcessMicChunk(chunk: QueuedChunk): boolean {
  const rms = chunk.rms ?? 0
  recordMicSpeech(chunk.enqueuedAt, rms)

  if (rms < MIC_SPEECH_RMS_MIN) return false

  return true
}

async function processMicChunk(chunk: QueuedChunk): Promise<void> {
  if (!options) return

  if (!shouldProcessMicChunk(chunk)) {
    updateActivityState()
    return
  }

  if (shouldSkipMicChunkBeforeTranscribe(chunk)) {
    updateActivityState()
    return
  }

  const entries = options.getEntries()
  const prompt = buildTranscriptionPrompt(entries, 'mic')
  const transcript = await processAudioChunk(chunk.base64, {
    source: 'mic',
    prompt,
  })

  if (!transcript) {
    updateActivityState()
    return
  }
  const target = resolveMicEntryTarget(chunk)
  if (!target) {
    updateActivityState()
    return
  }

  emitEntry(chunk, transcript, target.speaker, target.source)
  updateActivityState()
}

async function flushSystemDiarizeBuffer(chunk: QueuedChunk): Promise<void> {
  if (!options || systemDiarizeBuffer.length === 0) return
  const windowOffsetMs = systemDiarizeBufferAudioOffsetMs
  const buffers = systemDiarizeBuffer.map((item) => Buffer.from(item.base64, 'base64'))
  systemDiarizeBuffer = []
  systemDiarizeBufferStartedAt = 0
  systemDiarizeBufferAudioOffsetMs = 0
  const merged = mergeWavBuffers(buffers)
  if (!merged) {
    updateActivityState()
    return
  }
  const mergedBase64 = merged.toString('base64')
  const utterances = await transcribeSystemWithDiarization(mergedBase64)
  if (utterances && utterances.length > 0) {
    const labels = utterances.map((u) => stableDiarizedSpeaker(u.deepgramIndex, u.speaker))
    console.log(`Diarize OK: ${utterances.length} utterance(s) → ${[...new Set(labels)].join(', ')}`)
    for (let i = 0; i < utterances.length; i += 1) {
      const utterance = utterances[i]!
      const speaker = labels[i]!
      const audioStartMs =
        typeof utterance.startSec === 'number'
          ? Math.max(0, Math.round(windowOffsetMs + utterance.startSec * 1000))
          : windowOffsetMs
      const audioEndMs =
        typeof utterance.endSec === 'number'
          ? Math.max(audioStartMs, Math.round(windowOffsetMs + utterance.endSec * 1000))
          : undefined
      // Deepgram diarize API output — confidence-gated, not Whisper hallucination-prone.
      emitEntry(chunk, utterance.text, speaker, 'system', { audioStartMs, audioEndMs }, true)
    }
  } else {
    // Don't drop system speech when diarize fails — keep a single Speaker 1 line.
    console.warn('Diarize empty; falling back to single-speaker STT as Speaker 1')
    const transcript = await processAudioChunk(mergedBase64, {
      source: 'system',
      prompt: buildTranscriptionPrompt(options.getEntries(), 'system'),
    })
    if (transcript) {
      const speaker = stableDiarizedSpeaker(0, 'Speaker 1')
      // Whisper fallback — keep strict/untrusted hallucination checking.
      emitEntry(chunk, transcript, speaker, 'system', {
        audioStartMs: windowOffsetMs,
        audioEndMs: windowOffsetMs + 4000,
      })
    }
  }
  updateActivityState()
}

async function processSystemChunk(chunk: QueuedChunk): Promise<void> {
  if (!options || getIsPaused()) return

  const audioBuffer = Buffer.from(chunk.base64, 'base64')
  const rms = wavRms(audioBuffer)
  const hadEnergy = wavHasSpeechEnergy(audioBuffer)
  updateSystemChunkWindow(chunk.enqueuedAt, rms, hadEnergy)

  if (!hadEnergy) {
    updateActivityState()
    return
  }

  recordSystemSpeech(chunk.enqueuedAt, rms)

  if (systemDiarizeBuffer.length === 0) {
    systemDiarizeBufferStartedAt = chunk.enqueuedAt
    systemDiarizeBufferAudioOffsetMs =
      typeof chunk.audioOffsetMs === 'number' ? chunk.audioOffsetMs : 0
  }
  systemDiarizeBuffer.push(chunk)
  const elapsed = chunk.enqueuedAt - systemDiarizeBufferStartedAt
  if (
    systemDiarizeBuffer.length >= SYSTEM_DIARIZE_MIN_CHUNKS ||
    elapsed >= SYSTEM_DIARIZE_BUFFER_MS
  ) {
    await flushSystemDiarizeBuffer(chunk)
  } else {
    updateActivityState()
  }
}
