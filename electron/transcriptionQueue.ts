import { randomUUID } from 'crypto'
import { isDualCallMode, isGroupCallMode } from './audioPreferences'
import { transcribeSystemWithDiarization } from './diarizeTranscribe'
import { processAudioChunk, getIsPaused, wavHasSpeechEnergy, wavRms } from './audio'
import {
  buildTranscriptionPrompt,
  isDiarizedSpeakerLabel,
  isDuplicateAcrossStreams,
  isDuplicateOfRecent,
  isLikelyHallucination,
  isNearDuplicate,
  normalizeTranscriptText,
  speakerLabel,
  type TranscriptEntry,
  type TranscriptSource,
} from './transcriptUtils'

export type TranscriptionActivityState = 'silent' | 'listening' | 'transcribing'

type QueuedChunk = {
  base64: string
  source: TranscriptSource
  enqueuedAt: number
  rms?: number
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

const SYSTEM_FIRST_WAIT_MS = 500
const MAX_CONCURRENT_MIC = 2
const MAX_CONCURRENT_SYSTEM = 2
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
let systemCaptureActiveSince = 0

const SYSTEM_CAPTURE_WARMUP_MS = 3000

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
): void {
  if (!base64 || !options || getIsPaused()) return
  if (source === 'mic' && isGroupCallMode()) return
  const chunk: QueuedChunk = { base64, source, enqueuedAt: Date.now(), rms }
  if (source === 'mic') {
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

async function waitForSystemDrain(maxMs = SYSTEM_FIRST_WAIT_MS): Promise<void> {
  if (maxMs <= 0) return
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    if (activeSystemJobs === 0 && queueSystem.length === 0) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
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
  if (!isDualCallMode()) {
    return { speaker: 'Me', source: 'mic' }
  }

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
  if (!isDualCallMode()) return false

  const micRms = chunk.rms ?? 0
  const captureActive = isSystemCaptureSessionActive(chunk.enqueuedAt)
  const maxSystemRms = getMaxRecentSystemRms(chunk.enqueuedAt)

  if (!captureActive && !hasRecentSystemEnergy(chunk.enqueuedAt)) return false
  return !isClearlyUserMicSpeech(micRms, maxSystemRms, captureActive)
}

function micMatchesRecentThem(
  transcript: string,
  chunk: QueuedChunk,
  entries: TranscriptEntry[],
): boolean {
  for (const entry of entries.slice(-24).reverse()) {
    if (speakerLabel(entry) !== 'Them') continue
    if (Math.abs(entry.at - chunk.enqueuedAt) > MIC_BLEED_WINDOW_MS) continue
    if (isNearDuplicate(transcript, entry.text)) return true
  }
  return false
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

function shouldSkipMicBleed(
  transcript: string,
  chunk: QueuedChunk,
  entries: TranscriptEntry[],
): boolean {
  if (!isDualCallMode()) return false

  if (micMatchesRecentThem(transcript, chunk, entries)) return true

  return isDuplicateAcrossStreams(transcript, entries, chunk.enqueuedAt, 'mic')
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

function emitEntry(
  chunk: QueuedChunk,
  text: string,
  speaker: string,
  source: TranscriptSource,
): void {
  if (!options) return

  const entries = options.getEntries()
  const normalized = normalizeTranscriptText(text)
  if (!normalized || isLikelyHallucination(normalized, source)) return
  if (
    isDuplicateOfRecent(normalized, entries, 12_000, {
      speaker,
      source,
      at: chunk.enqueuedAt,
    })
  ) {
    return
  }
  const skipCrossStream =
    isGroupCallMode() && source === 'system' && isDiarizedSpeakerLabel(speaker)
  if (
    !skipCrossStream &&
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
  }

  if (source === 'system' && isDualCallMode()) {
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
  if (!options || isGroupCallMode()) return

  if (!shouldProcessMicChunk(chunk)) {
    updateActivityState()
    return
  }

  if (shouldSkipMicChunkBeforeTranscribe(chunk)) {
    updateActivityState()
    return
  }

  if (isDualCallMode()) {
    await waitForSystemDrain()
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

  if (shouldSkipMicBleed(transcript, chunk, entries)) {
    updateActivityState()
    return
  }

  emitEntry(chunk, transcript, target.speaker, target.source)
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

  if (isGroupCallMode()) {
    const utterances = await transcribeSystemWithDiarization(chunk.base64)
    if (utterances && utterances.length > 0) {
      for (const utterance of utterances) {
        emitEntry(chunk, utterance.text, utterance.speaker, 'system')
      }
    }
    updateActivityState()
    return
  }

  const entries = options.getEntries()
  const prompt = buildTranscriptionPrompt(entries, 'system')
  const transcript = await processAudioChunk(chunk.base64, {
    source: 'system',
    prompt,
  })

  if (!transcript) {
    updateActivityState()
    return
  }

  emitEntry(chunk, transcript, 'Them', 'system')
  updateActivityState()
}
