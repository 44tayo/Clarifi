// ALL API calls must happen here in the main process only.
// NEVER send API keys to the renderer via IPC.
// Renderer sends prompts → main process calls API → main returns result.

import { BrowserWindow, ipcMain, shell } from 'electron'
import {
  getIsPaused,
  getIsRecording,
  pauseRecording,
  resumeRecording,
  startRecording,
  stopRecording,
  wavHasSpeechEnergy,
  wavRms,
} from '../audio'
import { composeDictationFromAudio } from '../dictation'
import {
  getDictationTargetApp,
  startDictationTargetTracking,
  trackExternalFrontmostApp,
} from '../dictationInsert'
import {
  getOverlayWindow,
  isContentProtectionEnabled,
  isOverlayFollowEnabled,
  setContentProtectionEnabled,
  getOverlaySize,
  markOverlayReady,
  setOverlayHeight,
  setOverlayInteractive,
  setOverlaySize,
  toggleContentProtection,
  toggleOverlayFollow,
} from '../overlay'

let screenContextEnabled = false
import {
  analyzeLiveSession,
  chatWithMeetingContext,
  chatWithStoredAudioSession,
  generateGeneralAnswerAssist,
  generateSalesSuggestionAssist,
  generateSalesTermDefine,
  generateSessionRecap,
  generateSuggestions,
  getCachedSalesDefines,
  inferSpeakerLabels,
  resetSuggestionState,
  type SalesAssistAction,
  type SessionRecap,
} from '../llm'
import { extractAllJargonTerms, salesTailNeedsFastAnswer } from '../salesAssistTrigger'
import {
  deleteAudioSession,
  getAudioSessionById,
  loadAudioSessions,
  renameAudioSession,
  saveAudioSession,
  updateAudioSessionChat,
  updateAudioSessionSpeakerLabels,
  type AudioSessionChatMessage,
  type StoredAudioSession,
} from '../audioSessionHistory'
import {
  clearSystemCaptureActive,
  clearTranscriptionQueue,
  configureTranscriptionQueue,
  enqueueTranscription,
  flushTranscriptionQueue,
  markSystemCaptureActive,
  noteSystemAudioEnergy,
} from '../transcriptionQueue'
import {
  entriesToLines,
  normalizeTranscriptEntry,
  type TranscriptEntry,
  type TranscriptSource,
} from '../transcriptUtils'
import { captureScreenForContext } from '../screenCapture'
import { startSystemAudio, stopSystemAudio } from '../systemAudio'
import {
  hideAuthPane,
  showAuthPane,
  syncAuthPaneBounds,
} from '../onboardingAuthPane'
import {
  beginLiveOverlayTour,
  completeOnboarding,
  endLiveOverlayTour,
} from '../onboarding'
import {
  isTutorialStep,
  signalTutorialAction,
  startTutorial,
  stopTutorial,
  type TutorialStep,
} from '../onboardingTutorial'
import { isOnboardingComplete } from '../onboardingState'
import {
  allPermissionsGranted,
  getPermissionStatuses,
  openPermissionSettings,
  requestPermission,
  type PermissionKind,
} from '../permissions'
import {
  getBillingUrl,
  getConnectPageUrl,
  getSignInUrl,
  isDevicePaired,
} from '../deviceAuth'
import { getClarifiApiUrl } from '../keys'
import { getKey, saveKey } from '../store'
import {
  archiveChatSession,
  clearChatSessions,
  deleteChatSession,
  getChatSessionById,
  loadChatSessions,
  renameChatSession,
  saveChatSession,
  type ChatSession,
} from '../chatHistory'
import {
  clearChatSessionsFromMemory,
  clearAudioSessionsFromMemory,
  deleteChatSessionFromMemory,
  deleteAudioSessionFromMemory,
  syncAudioSessionToMemory,
  syncChatSessionToMemory,
} from '../memory/sessionSync'
import { handleMemoryIpc } from '../memory/memoryHandlers'
import { handleProactiveIpc } from '../proactive'
import {
  loadKeybindPreferences,
  resetKeybind,
  resetKeybindPreferences,
  saveKeybindPreferences,
  toPublicKeybindPreferences,
  validateKeybindAssignment,
  type KeybindActionId,
} from '../keybindPreferences'
import { registerKeybinds } from '../keybindManager'
import {
  eraseLocalAccountData,
  logoutDevice,
  quitApp,
  resetOnboardingFlow,
} from '../accountActions'
import {
  loadAudioPreferences,
  saveAudioPreferences,
  type AudioPreferences,
} from '../audioPreferences'
import { fetchDeviceProfile, getDashboardUrl, updateDeviceProfile } from '../deviceAuth'
import {
  disconnectGmailAccount,
  fetchGmailConnectUrl,
  fetchGmailSearch,
  fetchGmailSearchForMessage,
  fetchGmailStatus,
  getGmailConnectUrl,
  messageRequestsGmailContext,
} from '../gmailSync'
import {
  disconnectHubSpot,
  fetchHubSpotStatus,
  getHubSpotConnectUrl,
  maybeAutoSyncSession,
  updateHubSpotSettings,
} from '../hubspotSync'
import { removeLocalAvatar, saveLocalAvatar } from '../profileLocal'
import { normalizeSettingsTab, openSettingsWindow } from '../settings'
import {
  addCustomModel,
  createMode,
  getActiveMode,
  loadUserPreferences,
  removeCustomMode,
  removeCustomModel,
  setActiveMode,
  setActiveModel,
  setGeneralKnowledge,
  setProductKnowledge,
  setWorkKnowledge,
  setShowModelInToolbar,
  toPublicPreferences,
  type ModelProvider,
} from '../userPreferences'

let sessionTranscriptEntries: TranscriptEntry[] = []
let onSystemAudioData: ((buffer: Buffer) => void) | null = null

const SESSION_TRANSCRIPT_MAX = 500

const MAX_STRING_LENGTH = 50_000
const HTML_TAG_REGEX = /<[^>]*>/g

const LLM_RATE_LIMIT = { max: 10, windowMs: 60_000 }
const GENERAL_ANSWER_DEBOUNCE_MS = 1_000
const GENERAL_ANSWER_FAST_DEBOUNCE_MS = 450
const GENERAL_ANSWER_MIN_INTERVAL_MS = 1_000
const GENERAL_ANSWER_FAST_MIN_INTERVAL_MS = 700

let lastGeneralAnswerRunAt = 0
let liveAssistDirty = false
let liveAssistInFlight = false
let liveAssistDebounceTimer: NodeJS.Timeout | null = null
let stickyLiveActions: SalesAssistAction[] = []

function normalizeAnswerLabel(action: SalesAssistAction): SalesAssistAction {
  let label = action.label.trim()
  if (/^question\b/i.test(label)) {
    label = label.replace(/^question:?\s*/i, '').trim()
  }

  const isAnswerLane =
    action.kind === 'product_info' ||
    action.kind === 'objection' ||
    /^answer\b/i.test(label)

  if (!isAnswerLane) return action

  if (action.kind === 'objection' && !/^rebuttal\b/i.test(label)) {
    label = label.startsWith('Rebuttal:') ? label : `Rebuttal: ${label}`
  } else if (!/^answer\b/i.test(label)) {
    label = `Answer: ${label}`
  }

  return {
    ...action,
    kind: action.kind === 'objection' ? 'objection' : 'product_info',
    label,
  }
}

function defineToAction(term: string, speakable: string, context?: string): SalesAssistAction {
  return {
    kind: 'technical_lookup',
    label: `Define ${term}`,
    speakable,
    context,
  }
}

function mergeLiveActions(
  existing: SalesAssistAction[],
  incoming: SalesAssistAction[],
): SalesAssistAction[] {
  const byKey = new Map(existing.map((a) => [`${a.kind}:${a.label.toLowerCase()}`, a]))
  for (const action of incoming) {
    byKey.set(`${action.kind}:${action.label.toLowerCase()}`, action)
  }
  return Array.from(byKey.values()).slice(-6)
}

async function buildLiveAssistActions(lines: string[]): Promise<SalesAssistAction[]> {
  const fresh: SalesAssistAction[] = []

  const answerResult = await generateGeneralAnswerAssist(lines)
  if (answerResult?.answer) {
    fresh.push(normalizeAnswerLabel(answerResult.answer))
  }

  const terms = extractAllJargonTerms(lines)
  const uncached = terms.filter((t) => {
    const cached = getCachedSalesDefines().some((d) => d.term.toLowerCase() === t.toLowerCase())
    return !cached
  })
  if (uncached.length > 0) {
    const def = await generateSalesTermDefine(uncached[uncached.length - 1], lines)
    if (def) {
      fresh.push(defineToAction(def.term, def.speakable, def.context))
    }
  }

  for (const def of getCachedSalesDefines()) {
    fresh.push(defineToAction(def.term, def.speakable, def.context))
  }

  const suggestResult = await generateSalesSuggestionAssist(lines)
  if (suggestResult?.suggestions) {
    fresh.push(...suggestResult.suggestions)
  }

  return fresh
}

function broadcastLiveAssistUpdate(actions: SalesAssistAction[], error?: string): void {
  const overlay = getOverlayWindow()
  if (!overlay || overlay.isDestroyed()) return
  overlay.webContents.send('live-assist:update', {
    actions,
    error: error ?? null,
  })
}

function resetLiveAssistScheduler(): void {
  liveAssistDirty = false
  stickyLiveActions = []
  if (liveAssistDebounceTimer) clearTimeout(liveAssistDebounceTimer)
  liveAssistDebounceTimer = null
}

type RateLimitBucket = {
  count: number
  resetAt: number
}

class RateLimiter {
  private buckets = new Map<string, RateLimitBucket>()

  check(key: string, max: number, windowMs: number): boolean {
    const now = Date.now()
    const bucket = this.buckets.get(key)

    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs })
      return true
    }

    if (bucket.count >= max) {
      return false
    }

    bucket.count += 1
    return true
  }
}

const rateLimiter = new RateLimiter()

function sanitizeString(value: string): string {
  const stripped = value.replace(HTML_TAG_REGEX, '')
  if (stripped.length > MAX_STRING_LENGTH) {
    throw new Error(`Input exceeds maximum length of ${MAX_STRING_LENGTH} characters`)
  }
  return stripped
}

function sanitizeInput(data: unknown): unknown {
  if (data === null || data === undefined) {
    throw new Error('Input is required')
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data
  }

  if (typeof data === 'string') {
    return sanitizeString(data)
  }

  if (Array.isArray(data)) {
    return data.map((item) =>
      item === null || item === undefined ? item : sanitizeInput(item),
    )
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (value === null || value === undefined) {
        result[key] = value
      } else {
        result[key] = sanitizeInput(value)
      }
    }
    return result
  }

  return data
}

type IpcHandlerOptions = {
  requiresInput?: boolean
  rateLimitKey?: string
  rateLimit?: { max: number; windowMs: number }
}

function registerValidatedHandler(
  channel: string,
  options: IpcHandlerOptions,
  handler: (data: unknown) => Promise<unknown> | unknown,
): void {
  ipcMain.handle(channel, async (_event, data) => {
    if (options.rateLimitKey && options.rateLimit) {
      const allowed = rateLimiter.check(
        options.rateLimitKey,
        options.rateLimit.max,
        options.rateLimit.windowMs,
      )
      if (!allowed) {
        return {
          error: 'rate_limit_exceeded',
          message: 'Assist is updating too quickly — wait a few seconds.',
        }
      }
    }

    if (options.requiresInput && (data === null || data === undefined)) {
      throw new Error('Input is required')
    }

    const sanitized =
      data !== null && data !== undefined ? sanitizeInput(data) : data

    return handler(sanitized)
  })
}

async function queryOpenAI(prompt: string, apiKey: string): Promise<unknown> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    return { error: 'llm_request_failed', status: response.status }
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  return {
    content: body.choices?.[0]?.message?.content ?? '',
    provider: 'openai',
  }
}

async function queryAnthropic(prompt: string, apiKey: string): Promise<unknown> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    return { error: 'llm_request_failed', status: response.status }
  }

  const body = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>
  }

  const textBlock = body.content?.find((block) => block.type === 'text')

  return {
    content: textBlock?.text ?? '',
    provider: 'anthropic',
  }
}

function resetGeneralAssistScheduler(): void {
  resetLiveAssistScheduler()
}

async function flushLiveAssistUpdate(): Promise<void> {
  if (!liveAssistDirty) return

  const lines = getSessionTranscript()
  const fast = salesTailNeedsFastAnswer(lines)
  const debounceMs = fast ? GENERAL_ANSWER_FAST_DEBOUNCE_MS : GENERAL_ANSWER_DEBOUNCE_MS
  const minInterval = fast ? GENERAL_ANSWER_FAST_MIN_INTERVAL_MS : GENERAL_ANSWER_MIN_INTERVAL_MS
  const now = Date.now()

  if (liveAssistInFlight) {
    liveAssistDebounceTimer = setTimeout(() => void flushLiveAssistUpdate(), debounceMs)
    return
  }
  if (now - lastGeneralAnswerRunAt < minInterval) {
    liveAssistDebounceTimer = setTimeout(
      () => void flushLiveAssistUpdate(),
      minInterval - (now - lastGeneralAnswerRunAt),
    )
    return
  }

  liveAssistDirty = false
  liveAssistInFlight = true
  lastGeneralAnswerRunAt = now

  try {
    const fresh = await buildLiveAssistActions(lines)
    if (fresh.length > 0) {
      stickyLiveActions = mergeLiveActions(stickyLiveActions, fresh)
    }
    broadcastLiveAssistUpdate(stickyLiveActions)
  } catch (err) {
    console.error('Live assist error:', err)
    broadcastLiveAssistUpdate(stickyLiveActions, 'Assist is temporarily unavailable.')
  } finally {
    liveAssistInFlight = false
    if (liveAssistDirty) scheduleLiveAssistUpdate()
  }
}

function scheduleLiveAssistUpdate(): void {
  liveAssistDirty = true
  const lines = getSessionTranscript()
  const debounceMs = salesTailNeedsFastAnswer(lines)
    ? GENERAL_ANSWER_FAST_DEBOUNCE_MS
    : GENERAL_ANSWER_DEBOUNCE_MS
  if (liveAssistDebounceTimer) clearTimeout(liveAssistDebounceTimer)
  liveAssistDebounceTimer = setTimeout(() => void flushLiveAssistUpdate(), debounceMs)
}

async function updateLiveAssistForOverlay(lines: string[]): Promise<void> {
  scheduleLiveAssistUpdate()
}

function broadcastTranscriptUpdate(): void {
  const recent = sessionTranscriptEntries.slice(-50)
  const overlay = getOverlayWindow()
  if (overlay && !overlay.isDestroyed()) {
    overlay.webContents.send('transcript:update', {
      recent,
      full: sessionTranscriptEntries,
    })
  }
  void updateLiveAssistForOverlay(entriesToLines(sessionTranscriptEntries))
}

function pushTranscriptEntry(entry: TranscriptEntry): void {
  sessionTranscriptEntries.push(normalizeTranscriptEntry(entry))
  sessionTranscriptEntries.sort((a, b) => a.at - b.at)
  if (sessionTranscriptEntries.length > SESSION_TRANSCRIPT_MAX) {
    sessionTranscriptEntries = sessionTranscriptEntries.slice(-SESSION_TRANSCRIPT_MAX)
  }
  broadcastTranscriptUpdate()
}

function pruneTranscriptEntries(entryIds: string[]): void {
  if (entryIds.length === 0) return
  const remove = new Set(entryIds)
  const before = sessionTranscriptEntries.length
  sessionTranscriptEntries = sessionTranscriptEntries.filter((entry) => !remove.has(entry.id))
  if (sessionTranscriptEntries.length !== before) {
    broadcastTranscriptUpdate()
  }
}

function getSessionTranscript(): string[] {
  return entriesToLines(sessionTranscriptEntries)
}

function getSessionTranscriptEntries(): TranscriptEntry[] {
  return [...sessionTranscriptEntries]
}

function broadcastTranscriptionActivity(
  state: 'silent' | 'listening' | 'transcribing',
): void {
  const overlay = getOverlayWindow()
  if (overlay && !overlay.isDestroyed()) {
    overlay.webContents.send('transcription:activity', { state })
  }
}

function enqueueAudioChunk(
  base64: string,
  source: TranscriptSource,
  rms?: number,
): void {
  enqueueTranscription(base64, source, rms)
}

let handlersRegistered = false

export function registerHandlers(mainWindow?: BrowserWindow | null): void {
  if (handlersRegistered) return

  void mainWindow

  ipcMain.handle('overlay:set-interactive', (_event, interactive: boolean) => {
    setOverlayInteractive(interactive)
  })

  ipcMain.handle('overlay:set-height', (_event, height: number) => {
    if (typeof height === 'number' && Number.isFinite(height)) {
      setOverlayHeight(height)
    }
  })

  ipcMain.handle(
    'overlay:set-bounds',
    (_event, bounds: {
      width?: number
      height?: number
      x?: number
      y?: number
      persist?: boolean
    }) => {
      if (
        bounds &&
        typeof bounds.width === 'number' &&
        Number.isFinite(bounds.width) &&
        typeof bounds.height === 'number' &&
        Number.isFinite(bounds.height)
      ) {
        setOverlaySize(
          bounds.width,
          bounds.height,
          bounds.persist !== false,
          bounds.x,
          bounds.y,
        )
      }
    },
  )

  ipcMain.handle('overlay:get-bounds', () => {
    return getOverlaySize()
  })

  ipcMain.handle('chat:history-load', () => {
    return { sessions: loadChatSessions() }
  })

  registerValidatedHandler(
    'chat:history-save-session',
    { requiresInput: true },
    (data) => {
      const payload = data as { session?: ChatSession }
      if (!payload.session || typeof payload.session !== 'object') {
        throw new Error('session is required')
      }
      const session = payload.session
      if (typeof session.id !== 'string' || typeof session.title !== 'string') {
        throw new Error('invalid session')
      }
      const sessions = saveChatSession(session)
      syncChatSessionToMemory(session)
      return { sessions }
    },
  )

  registerValidatedHandler(
    'chat:history-delete-session',
    { requiresInput: true },
    (data) => {
      const payload = data as { id?: string }
      if (!payload.id || typeof payload.id !== 'string') {
        throw new Error('id is required')
      }
      const sessions = deleteChatSession(payload.id)
      deleteChatSessionFromMemory(payload.id)
      return { sessions }
    },
  )

  ipcMain.handle('chat:history-clear', () => {
    const sessions = clearChatSessions()
    clearChatSessionsFromMemory()
    return { sessions }
  })

  registerValidatedHandler(
    'chat:history-rename-session',
    { requiresInput: true },
    (data) => {
      const payload = data as { id?: string; title?: string }
      if (!payload.id || typeof payload.id !== 'string') {
        throw new Error('id is required')
      }
      if (!payload.title || typeof payload.title !== 'string') {
        throw new Error('title is required')
      }
      const sessions = renameChatSession(payload.id, payload.title)
      const updated = sessions.find((s) => s.id === payload.id)
      if (updated) syncChatSessionToMemory(updated)
      return { sessions }
    },
  )

  registerValidatedHandler(
    'chat:history-archive-session',
    { requiresInput: true },
    (data) => {
      const payload = data as { id?: string; archived?: boolean }
      if (!payload.id || typeof payload.id !== 'string') {
        throw new Error('id is required')
      }
      const sessions = archiveChatSession(payload.id, Boolean(payload.archived))
      const updated = sessions.find((s) => s.id === payload.id)
      if (updated) syncChatSessionToMemory(updated)
      return { sessions }
    },
  )

  registerValidatedHandler(
    'chat:history-open-session',
    { requiresInput: true },
    (data) => {
      const payload = data as { id?: string }
      if (!payload.id || typeof payload.id !== 'string') {
        throw new Error('id is required')
      }
      const session = getChatSessionById(payload.id)
      if (!session) {
        throw new Error('session not found')
      }
      const overlay = getOverlayWindow()
      if (overlay && !overlay.isDestroyed()) {
        overlay.show()
        overlay.focus()
        overlay.webContents.send('chat:session-open', session)
      }
      return { ok: true }
    },
  )

  ipcMain.handle('audio-sessions:load', () => {
    return { sessions: loadAudioSessions() }
  })

  // Audio sessions bypass recursive sanitizeInput — recap may be null and transcripts are large.
  ipcMain.handle('audio-sessions:save', (_event, data) => {
    const payload = data as { session?: StoredAudioSession }
    if (!payload?.session || typeof payload.session !== 'object') {
      throw new Error('session is required')
    }
    const session = payload.session
    if (typeof session.id !== 'string' || typeof session.title !== 'string') {
      throw new Error('invalid session')
    }
    const sessions = saveAudioSession(session)
    syncAudioSessionToMemory(session)
    return { sessions }
  })

  registerValidatedHandler(
    'audio-sessions:delete',
    { requiresInput: true },
    (data) => {
      const payload = data as { id?: string }
      if (!payload.id || typeof payload.id !== 'string') {
        throw new Error('id is required')
      }
      const sessions = deleteAudioSession(payload.id)
      deleteAudioSessionFromMemory(payload.id)
      return { sessions }
    },
  )

  registerValidatedHandler(
    'audio-sessions:rename',
    { requiresInput: true },
    (data) => {
      const payload = data as { id?: string; title?: string }
      if (!payload.id || typeof payload.id !== 'string') {
        throw new Error('id is required')
      }
      if (!payload.title || typeof payload.title !== 'string') {
        throw new Error('title is required')
      }
      const sessions = renameAudioSession(payload.id, payload.title)
      const updated = sessions.find((s) => s.id === payload.id)
      if (updated) syncAudioSessionToMemory(updated)
      return { sessions }
    },
  )

  registerValidatedHandler(
    'audio-sessions:update-chat',
    { requiresInput: true },
    (data) => {
      const payload = data as { id?: string; messages?: AudioSessionChatMessage[] }
      if (!payload.id || typeof payload.id !== 'string') {
        throw new Error('id is required')
      }
      if (!Array.isArray(payload.messages)) {
        throw new Error('messages is required')
      }
      const sessions = updateAudioSessionChat(payload.id, payload.messages)
      const updated = sessions.find((s) => s.id === payload.id)
      if (updated) syncAudioSessionToMemory(updated)
      return { sessions }
    },
  )

  registerValidatedHandler(
    'audio-sessions:update-speaker-labels',
    { requiresInput: true },
    (data) => {
      const payload = data as { id?: string; speakerLabels?: Record<string, string> }
      if (!payload.id || typeof payload.id !== 'string') {
        throw new Error('id is required')
      }
      if (!payload.speakerLabels || typeof payload.speakerLabels !== 'object') {
        throw new Error('speakerLabels is required')
      }
      const speakerLabels: Record<string, string> = {}
      for (const [key, value] of Object.entries(payload.speakerLabels)) {
        if (typeof key === 'string' && typeof value === 'string' && value.trim()) {
          speakerLabels[key] = value.trim().slice(0, 48)
        }
      }
      const sessions = updateAudioSessionSpeakerLabels(payload.id, speakerLabels)
      const updated = sessions.find((s) => s.id === payload.id)
      if (updated) syncAudioSessionToMemory(updated)
      return { sessions }
    },
  )

  registerValidatedHandler(
    'audio-sessions:open',
    { requiresInput: true },
    (data) => {
      const payload = data as { id?: string }
      if (!payload.id || typeof payload.id !== 'string') {
        throw new Error('id is required')
      }
      const session = getAudioSessionById(payload.id)
      if (!session) {
        throw new Error('session not found')
      }
      const overlay = getOverlayWindow()
      if (overlay && !overlay.isDestroyed()) {
        overlay.show()
        overlay.focus()
        overlay.webContents.send('audio-sessions:open', session)
      }
      return { ok: true }
    },
  )

  registerValidatedHandler(
    'audio-sessions:chat',
    { rateLimitKey: 'audio-sessions:chat', rateLimit: LLM_RATE_LIMIT },
    async (data) => {
      const payload = data as {
        message?: string
        transcriptLines?: string[]
        recap?: SessionRecap | null
        speakerLabels?: Record<string, string>
      }
      if (!payload.message || typeof payload.message !== 'string') {
        throw new Error('message is required')
      }
      const lines = Array.isArray(payload.transcriptLines)
        ? payload.transcriptLines.filter((line): line is string => typeof line === 'string')
        : []
      const recap =
        payload.recap && typeof payload.recap === 'object' ? payload.recap : null
      const speakerLabels =
        payload.speakerLabels && typeof payload.speakerLabels === 'object'
          ? payload.speakerLabels
          : undefined
      return chatWithStoredAudioSession(payload.message, lines, recap, speakerLabels)
    },
  )

  registerValidatedHandler(
    'llm:infer-speaker-labels',
    { rateLimitKey: 'llm:infer-speaker-labels', rateLimit: LLM_RATE_LIMIT },
    async () => {
      return inferSpeakerLabels(getSessionTranscriptEntries())
    },
  )

  ipcMain.handle('overlay:toggle-follow', () => {
    return { enabled: toggleOverlayFollow() }
  })

  ipcMain.handle('overlay:follow-status', () => {
    return { enabled: isOverlayFollowEnabled() }
  })

  ipcMain.handle('overlay:ready', () => {
    markOverlayReady()
    return { ok: true }
  })

  ipcMain.handle(
    'overlay:toggle-protection',
    (_event, payload?: boolean | { enabled?: boolean }) => {
      let enabled: boolean | undefined
      if (typeof payload === 'boolean') {
        enabled = payload
      } else if (
        payload &&
        typeof payload === 'object' &&
        typeof payload.enabled === 'boolean'
      ) {
        enabled = payload.enabled
      }

      if (typeof enabled === 'boolean') {
        setContentProtectionEnabled(enabled)
      } else {
        toggleContentProtection()
      }
      return { enabled: isContentProtectionEnabled() }
    },
  )

  ipcMain.handle('overlay:protection-status', () => {
    return { enabled: isContentProtectionEnabled() }
  })

  ipcMain.handle('screen:context-enabled', (_event, enabled?: boolean) => {
    if (typeof enabled === 'boolean') {
      screenContextEnabled = enabled
    } else {
      screenContextEnabled = !screenContextEnabled
    }
    return { enabled: screenContextEnabled }
  })

  ipcMain.handle('screen:context-status', () => {
    return { enabled: screenContextEnabled }
  })

  ipcMain.handle('overlay:update-suggestions', (_event, suggestions: string[]) => {
    const overlay = getOverlayWindow()
    if (overlay) {
      overlay.webContents.send('suggestions:update', suggestions)
    }
  })

  registerValidatedHandler('ping', {}, () => 'pong')

  ipcMain.handle('llm:suggest', async (_event, lines: string[]) => {
    if (!Array.isArray(lines)) return []
    return generateSuggestions(lines)
  })

  registerValidatedHandler(
    'llm:session-analyze',
    { rateLimitKey: 'llm:session-analyze', rateLimit: LLM_RATE_LIMIT },
    async () => analyzeLiveSession(getSessionTranscript()),
  )

  registerValidatedHandler(
    'llm:session-recap',
    { rateLimitKey: 'llm:session-recap', rateLimit: LLM_RATE_LIMIT },
    async () => generateSessionRecap(getSessionTranscript()),
  )

  ipcMain.handle('audio:session-transcript', () => getSessionTranscriptEntries())

  ipcMain.handle('audio:start', async () => {
    sessionTranscriptEntries = []
    resetSuggestionState()
    resetGeneralAssistScheduler()
    clearTranscriptionQueue()

    configureTranscriptionQueue({
      getEntries: getSessionTranscriptEntries,
      onEntry: pushTranscriptEntry,
      onPruneEntries: pruneTranscriptEntries,
      onActivity: broadcastTranscriptionActivity,
    })

    const overlay = getOverlayWindow()
    if (overlay && !overlay.isDestroyed()) {
      overlay.webContents.send('transcript:update', { recent: [], full: [] })
      overlay.webContents.send('suggestions:update', [])
      overlay.webContents.send('live-assist:update', { actions: [], error: null })
    }

    startRecording(() => {
      // Transcripts are delivered through the transcription queue.
    })

    if (process.platform === 'darwin') {
      onSystemAudioData = (wavBuffer: Buffer) => {
        const rms = wavRms(wavBuffer)
        const hadEnergy = wavHasSpeechEnergy(wavBuffer)
        noteSystemAudioEnergy(rms, hadEnergy)
        const base64 = wavBuffer.toString('base64')
        enqueueAudioChunk(base64, 'system', rms)
      }
      if (startSystemAudio(onSystemAudioData)) {
        markSystemCaptureActive()
      }
    }

    return { status: 'started' }
  })

  ipcMain.handle('audio:pause', () => {
    pauseRecording()
    stopSystemAudio()
    clearSystemCaptureActive()
    return { status: 'paused', isPaused: getIsPaused() }
  })

  ipcMain.handle('audio:resume', () => {
    resumeRecording()
    if (process.platform === 'darwin' && onSystemAudioData) {
      if (startSystemAudio(onSystemAudioData)) {
        markSystemCaptureActive()
      }
    }
    return { status: 'resumed', isPaused: getIsPaused() }
  })

  ipcMain.handle('audio:stop', async () => {
    stopSystemAudio()
    clearSystemCaptureActive()
    stopRecording()
    onSystemAudioData = null
    await flushTranscriptionQueue()
    clearTranscriptionQueue()
    return { status: 'stopped' }
  })

  ipcMain.handle('audio:status', () => {
    return { isRecording: getIsRecording(), isPaused: getIsPaused() }
  })

  ipcMain.handle(
    'audio:chunk',
    (_event, payload: string | { base64?: string; source?: string; rms?: number }) => {
      const base64 = typeof payload === 'string' ? payload : payload?.base64
      const source: TranscriptSource =
        typeof payload === 'object' && payload?.source === 'system' ? 'system' : 'mic'
      const rms =
        typeof payload === 'object' && typeof payload.rms === 'number'
          ? payload.rms
          : undefined
      if (typeof base64 === 'string' && base64.length > 0) {
        enqueueAudioChunk(base64, source, rms)
      }
      return { status: 'queued' }
    },
  )

  registerValidatedHandler(
    'dictation:compose',
    { requiresInput: true, rateLimitKey: 'llm:chat', rateLimit: LLM_RATE_LIMIT },
    async (data) => {
      const payload = data as {
        audioBase64?: string
        target?: 'auto' | 'overlay' | 'focused_field'
        targetApp?: string | null
      }
      if (!payload.audioBase64 || typeof payload.audioBase64 !== 'string') {
        throw new Error('audioBase64 is required')
      }
      return composeDictationFromAudio(payload.audioBase64, {
        target: payload.target,
        targetApp: payload.targetApp,
      })
    },
  )

  registerValidatedHandler('dictation:get-target-app', {}, () => {
    trackExternalFrontmostApp()
    return { app: getDictationTargetApp() }
  })

  registerValidatedHandler(
    'screen:capture',
    { requiresInput: true },
    () => ({ status: 'screen_capture_requested' }),
  )

  registerValidatedHandler('auth:open-connect', {}, async () => {
    const url = getConnectPageUrl()
    await shell.openExternal(url)
    return { ok: true, url }
  })

  registerValidatedHandler('auth:open-sign-in', {}, async () => {
    const url = getSignInUrl()
    await shell.openExternal(url)
    return { ok: true, url }
  })

  registerValidatedHandler('auth:connection-status', {}, async () => {
    const apiUrl = getClarifiApiUrl()
    const connected = await isDevicePaired()
    return {
      connected,
      hasApiUrl: Boolean(apiUrl),
      connectUrl: getConnectPageUrl(),
    }
  })

  registerValidatedHandler(
    'auth:validate',
    { requiresInput: true },
    async (data) => {
      const payload = data as { service?: string; key?: string }
      const service = payload.service

      if (!service || typeof service !== 'string') {
        throw new Error('service is required')
      }

      if (payload.key && typeof payload.key === 'string') {
        await saveKey(service, payload.key)
      }

      const storedKey = await getKey(service)
      return { valid: Boolean(storedKey) }
    },
  )

  registerValidatedHandler(
    'llm:query',
    {
      requiresInput: true,
      rateLimitKey: 'llm',
      rateLimit: LLM_RATE_LIMIT,
    },
    async (data) => {
      const payload = data as { provider?: string; prompt?: string }
      const provider = payload.provider
      const prompt = payload.prompt

      if (!provider || typeof provider !== 'string') {
        throw new Error('provider is required')
      }

      if (!prompt || typeof prompt !== 'string') {
        throw new Error('prompt is required')
      }

      const apiKey = await getKey(provider)
      if (!apiKey) {
        return { error: 'api_key_not_found' }
      }

      if (provider === 'openai') {
        return queryOpenAI(prompt, apiKey)
      }

      if (provider === 'anthropic') {
        return queryAnthropic(prompt, apiKey)
      }

      return { error: 'unsupported_provider' }
    },
  )

  registerValidatedHandler(
    'llm:chat',
    {
      requiresInput: true,
      rateLimitKey: 'llm:chat',
      rateLimit: LLM_RATE_LIMIT,
    },
    async (data) => {
      const payload = data as {
        message?: string
        transcriptLines?: string[]
        useScreenContext?: boolean
      }

      if (!payload.message || typeof payload.message !== 'string') {
        throw new Error('message is required')
      }

      const lines = Array.isArray(payload.transcriptLines)
        ? payload.transcriptLines.filter((line): line is string => typeof line === 'string')
        : []

      const useScreenContext = Boolean(payload.useScreenContext)
      let screenImage:
        | { imageBase64: string; mimeType: 'image/png' }
        | undefined

      if (useScreenContext) {
        const capture = await captureScreenForContext()
        if ('error' in capture) {
          return { error: capture.error }
        }
        screenImage = {
          imageBase64: capture.imageBase64,
          mimeType: capture.mimeType,
        }
      }

      let emailContext: string | undefined
      let gmailResults: Awaited<ReturnType<typeof fetchGmailSearchForMessage>> | null = null
      let gmailNotConnected = false

      if (messageRequestsGmailContext(payload.message)) {
        const gmailStatus = await fetchGmailStatus()
        if (!gmailStatus.connected) {
          gmailNotConnected = true
        } else {
          gmailResults = await fetchGmailSearchForMessage(payload.message)
          emailContext = gmailResults?.context ?? undefined
        }
      }

      const chatResult = await chatWithMeetingContext({
        message: payload.message,
        transcriptLines: lines,
        useScreenContext,
        screenImage,
        emailContext,
      })

      if ('reply' in chatResult) {
        return {
          reply: chatResult.reply,
          gmailResults: gmailResults?.messages ?? undefined,
          gmailQuery: gmailResults?.query,
          gmailNotConnected: gmailNotConnected || undefined,
        }
      }

      return chatResult
    },
  )

  registerValidatedHandler('onboarding:status', {}, async () => {
    const complete = await isOnboardingComplete()
    return { complete }
  })

  registerValidatedHandler('onboarding:complete', {}, async () => {
    await completeOnboarding()
    return { ok: true }
  })

  registerValidatedHandler('onboarding:get-sign-in-url', {}, () => {
    return { url: getSignInUrl() }
  })

  registerValidatedHandler('onboarding:auth-pane-show', {}, () => {
    showAuthPane()
    return { ok: true }
  })

  registerValidatedHandler('onboarding:auth-pane-hide', {}, () => {
    hideAuthPane()
    return { ok: true }
  })

  registerValidatedHandler(
    'onboarding:auth-pane-sync',
    { requiresInput: true },
    (data) => {
      const payload = data as { x?: number; y?: number; width?: number; height?: number }
      if (
        typeof payload.x !== 'number' ||
        typeof payload.y !== 'number' ||
        typeof payload.width !== 'number' ||
        typeof payload.height !== 'number'
      ) {
        throw new Error('invalid auth pane bounds')
      }
      syncAuthPaneBounds({
        x: payload.x,
        y: payload.y,
        width: payload.width,
        height: payload.height,
      })
      return { ok: true }
    },
  )

  registerValidatedHandler('onboarding:get-billing-url', {}, () => {
    return { url: getBillingUrl() }
  })

  registerValidatedHandler('onboarding:open-billing', {}, async () => {
    const url = getBillingUrl()
    await shell.openExternal(url)
    return { ok: true, url }
  })

  registerValidatedHandler(
    'onboarding:start-tutorial',
    { requiresInput: true },
    (data) => {
      const payload = data as { step?: TutorialStep }
      const step = payload.step
      if (!step || !isTutorialStep(step)) {
        throw new Error('invalid tutorial step')
      }
      startTutorial(step)
      return { ok: true, step }
    },
  )

  registerValidatedHandler('onboarding:stop-tutorial', {}, () => {
    stopTutorial()
    return { ok: true }
  })

  registerValidatedHandler('onboarding:begin-live-tour', {}, () => {
    beginLiveOverlayTour()
    return { ok: true }
  })

  registerValidatedHandler('onboarding:end-live-tour', {}, () => {
    endLiveOverlayTour()
    stopTutorial()
    return { ok: true }
  })

  registerValidatedHandler('permissions:status', {}, () => {
    const statuses = getPermissionStatuses()
    return {
      ...statuses,
      allGranted: allPermissionsGranted(statuses),
    }
  })

  registerValidatedHandler(
    'permissions:request',
    { requiresInput: true },
    async (data) => {
      const payload = data as { kind?: PermissionKind }
      if (!payload.kind) {
        throw new Error('kind is required')
      }
      const granted = await requestPermission(payload.kind)
      const statuses = getPermissionStatuses()
      return {
        granted,
        ...statuses,
        allGranted: allPermissionsGranted(statuses),
      }
    },
  )

  registerValidatedHandler(
    'permissions:open-settings',
    { requiresInput: true },
    (data) => {
      const payload = data as { kind?: PermissionKind }
      if (!payload.kind) {
        throw new Error('kind is required')
      }
      openPermissionSettings(payload.kind)
      return { ok: true }
    },
  )

  registerValidatedHandler(
    'onboarding:tutorial-signal',
    { requiresInput: true },
    (data) => {
      const payload = data as { type?: TutorialStep }
      if (!payload.type || !isTutorialStep(payload.type)) {
        throw new Error('invalid tutorial signal')
      }
      signalTutorialAction(payload.type)
      return { ok: true }
    },
  )

  ipcMain.handle('prefs:load', () => {
    return toPublicPreferences(loadUserPreferences())
  })

  registerValidatedHandler(
    'prefs:set-active-model',
    { requiresInput: true },
    (data) => {
      const payload = data as { modelId?: string }
      if (!payload.modelId || typeof payload.modelId !== 'string') {
        throw new Error('modelId is required')
      }
      return setActiveModel(payload.modelId)
    },
  )

  registerValidatedHandler(
    'prefs:set-show-model-in-toolbar',
    { requiresInput: true },
    (data) => {
      const payload = data as { show?: boolean }
      if (typeof payload.show !== 'boolean') {
        throw new Error('show is required')
      }
      return setShowModelInToolbar(payload.show)
    },
  )

  registerValidatedHandler(
    'prefs:set-active-mode',
    { requiresInput: true },
    (data) => {
      const payload = data as { modeId?: string }
      if (!payload.modeId || typeof payload.modeId !== 'string') {
        throw new Error('modeId is required')
      }
      return setActiveMode(payload.modeId)
    },
  )

  registerValidatedHandler(
    'prefs:set-product-knowledge',
    { requiresInput: true },
    (data) => {
      const payload = data as { knowledge?: string }
      if (typeof payload.knowledge !== 'string') {
        throw new Error('knowledge is required')
      }
      return setProductKnowledge(payload.knowledge)
    },
  )

  registerValidatedHandler(
    'prefs:set-work-knowledge',
    { requiresInput: true },
    (data) => {
      const payload = data as { knowledge?: string }
      if (typeof payload.knowledge !== 'string') {
        throw new Error('knowledge is required')
      }
      return setWorkKnowledge(payload.knowledge)
    },
  )

  registerValidatedHandler(
    'prefs:set-general-knowledge',
    { requiresInput: true },
    (data) => {
      const payload = data as { knowledge?: string }
      if (typeof payload.knowledge !== 'string') {
        throw new Error('knowledge is required')
      }
      return setGeneralKnowledge(payload.knowledge)
    },
  )

  registerValidatedHandler(
    'prefs:add-mode',
    { requiresInput: true },
    (data) => {
      const payload = data as { label?: string; category?: string; description?: string }
      if (!payload.label || typeof payload.label !== 'string' || !payload.label.trim()) {
        throw new Error('label is required')
      }
      return createMode({
        label: payload.label,
        category: typeof payload.category === 'string' ? payload.category : undefined,
        description: typeof payload.description === 'string' ? payload.description : undefined,
      })
    },
  )

  registerValidatedHandler(
    'prefs:remove-mode',
    { requiresInput: true },
    (data) => {
      const payload = data as { modeId?: string }
      if (!payload.modeId || typeof payload.modeId !== 'string') {
        throw new Error('modeId is required')
      }
      return removeCustomMode(payload.modeId)
    },
  )

  registerValidatedHandler(
    'prefs:add-model',
    { requiresInput: true },
    async (data) => {
      const payload = data as {
        label?: string
        provider?: ModelProvider
        modelId?: string
        apiKey?: string
      }
      if (!payload.modelId || typeof payload.modelId !== 'string') {
        throw new Error('modelId is required')
      }
      if (!payload.apiKey || typeof payload.apiKey !== 'string') {
        throw new Error('apiKey is required')
      }
      const provider = payload.provider ?? 'anthropic'
      if (!['anthropic', 'openai', 'gemini', 'groq', 'custom'].includes(provider)) {
        throw new Error('invalid provider')
      }
      await addCustomModel({
        label: typeof payload.label === 'string' ? payload.label : payload.modelId,
        provider,
        modelId: payload.modelId,
        apiKey: payload.apiKey,
      })
      return toPublicPreferences(loadUserPreferences())
    },
  )

  registerValidatedHandler(
    'prefs:remove-model',
    { requiresInput: true },
    async (data) => {
      const payload = data as { modelId?: string }
      if (!payload.modelId || typeof payload.modelId !== 'string') {
        throw new Error('modelId is required')
      }
      return removeCustomModel(payload.modelId)
    },
  )

  registerValidatedHandler('settings:profile', {}, async () => {
    return fetchDeviceProfile()
  })

  registerValidatedHandler(
    'settings:profile-update',
    { requiresInput: true },
    async (data) => {
      const payload = data as { firstName?: string; lastName?: string }
      if (typeof payload.firstName !== 'string' || typeof payload.lastName !== 'string') {
        throw new Error('firstName and lastName are required')
      }
      return updateDeviceProfile({
        firstName: payload.firstName,
        lastName: payload.lastName,
      })
    },
  )

  // Avatar uploads bypass sanitizeInput — base64 images exceed the 50KB IPC string cap.
  ipcMain.handle('settings:profile-avatar-upload', async (_event, data) => {
    const payload = data as { base64?: string; mimeType?: string }
    if (!payload?.base64 || typeof payload.base64 !== 'string') {
      throw new Error('base64 is required')
    }
    if (payload.base64.length > 4_000_000) {
      throw new Error('Image too large (max 3MB)')
    }
    const mimeType =
      typeof payload.mimeType === 'string' && payload.mimeType ? payload.mimeType : 'image/png'
    saveLocalAvatar(payload.base64, mimeType)
    return fetchDeviceProfile()
  })

  registerValidatedHandler('settings:profile-avatar-remove', {}, async () => {
    removeLocalAvatar()
    return fetchDeviceProfile()
  })

  registerValidatedHandler('settings:open-dashboard', {}, async () => {
    const url = getDashboardUrl()
    await shell.openExternal(url)
    return { ok: true, url }
  })

  registerValidatedHandler('settings:hubspot-status', {}, async () => {
    return fetchHubSpotStatus()
  })

  registerValidatedHandler('settings:hubspot-open-connect', {}, async () => {
    const url = getHubSpotConnectUrl()
    await shell.openExternal(url)
    return { ok: true, url }
  })

  registerValidatedHandler(
    'settings:hubspot-update',
    { requiresInput: true },
    async (data) => {
      const payload = data as {
        autoSyncEnabled?: boolean
        defaultContactEmail?: string | null
        defaultDealId?: string | null
      }
      return updateHubSpotSettings(payload)
    },
  )

  registerValidatedHandler('settings:hubspot-disconnect', {}, async () => {
    const ok = await disconnectHubSpot()
    return { ok, status: await fetchHubSpotStatus() }
  })

  registerValidatedHandler('settings:gmail-status', {}, async () => {
    return fetchGmailStatus()
  })

  registerValidatedHandler('settings:gmail-open-connect', {}, async () => {
    const url = (await fetchGmailConnectUrl()) ?? getGmailConnectUrl()
    await shell.openExternal(url)
    return { ok: true, url }
  })

  registerValidatedHandler('settings:gmail-disconnect', {}, async () => {
    const ok = await disconnectGmailAccount()
    return { ok, status: await fetchGmailStatus() }
  })

  registerValidatedHandler(
    'gmail:search',
    { requiresInput: true },
    async (data) => {
      const payload = data as { message?: string; query?: string; maxResults?: number }
      const status = await fetchGmailStatus()
      if (!status.connected) {
        return { connected: false, configured: status.configured, messages: [] }
      }
      const result = await fetchGmailSearch({
        message: payload.message,
        query: payload.query,
        maxResults: payload.maxResults,
      })
      return result ?? { connected: true, messages: [], query: payload.query ?? '' }
    },
  )

  registerValidatedHandler(
    'gmail:open-url',
    { requiresInput: true },
    async (data) => {
      const payload = data as { url?: string }
      if (!payload.url?.trim()) throw new Error('url is required')
      await shell.openExternal(payload.url.trim())
      return { ok: true }
    },
  )

  registerValidatedHandler(
    'hubspot:sync-session',
    { requiresInput: true },
    async (data) => {
      const payload = data as {
        sessionId?: string
        title?: string
        endedAt?: number
        recap?: Record<string, unknown> | null
      }
      if (!payload.sessionId) {
        return { ok: false, error: 'session_id_required' }
      }
      return maybeAutoSyncSession({
        id: payload.sessionId,
        title: payload.title ?? 'Clarifi call',
        endedAt: payload.endedAt ?? Date.now(),
        recap: payload.recap ?? null,
      })
    },
  )

  registerValidatedHandler(
    'settings:open',
    { requiresInput: false },
    (data) => {
      const payload = (data ?? {}) as { tab?: string }
      openSettingsWindow(normalizeSettingsTab(payload.tab))
      return { ok: true }
    },
  )

  ipcMain.handle('audio:prefs-load', () => {
    return loadAudioPreferences()
  })

  registerValidatedHandler(
    'audio:prefs-save',
    { requiresInput: true },
    (data) => {
      const payload = data as Partial<AudioPreferences>
      const current = loadAudioPreferences()
      const next: AudioPreferences = {
        transcriptionLanguage:
          typeof payload.transcriptionLanguage === 'string'
            ? payload.transcriptionLanguage
            : current.transcriptionLanguage,
        outputLanguage:
          typeof payload.outputLanguage === 'string'
            ? payload.outputLanguage
            : current.outputLanguage,
        preferredMicrophoneId:
          typeof payload.preferredMicrophoneId === 'string'
            ? payload.preferredMicrophoneId
            : current.preferredMicrophoneId,
        preferredMicrophoneLabel:
          typeof payload.preferredMicrophoneLabel === 'string'
            ? payload.preferredMicrophoneLabel
            : current.preferredMicrophoneLabel,
        systemAudioCapture:
          payload.systemAudioCapture === 'display'
            ? 'display'
            : payload.systemAudioCapture === 'meeting'
              ? 'meeting'
              : current.systemAudioCapture,
        transcriptionMode:
          payload.transcriptionMode === 'dual'
            ? 'dual'
            : payload.transcriptionMode === 'group'
              ? 'group'
              : current.transcriptionMode,
      }
      saveAudioPreferences(next)
      return next
    },
  )

  registerValidatedHandler('app:reset-onboarding', {}, async () => {
    await resetOnboardingFlow()
    return { ok: true }
  })

  registerValidatedHandler('app:logout', {}, async () => {
    await logoutDevice()
    return { ok: true }
  })

  registerValidatedHandler('app:quit', {}, () => {
    quitApp()
    return { ok: true }
  })

  registerValidatedHandler('app:erase-account-data', {}, async () => {
    await eraseLocalAccountData()
    return { ok: true }
  })

  ipcMain.handle('keybinds:prefs-load', () => {
    return toPublicKeybindPreferences()
  })

  registerValidatedHandler(
    'keybinds:prefs-save',
    { requiresInput: true },
    (data) => {
      const payload = data as { action?: KeybindActionId; accelerator?: string }
      if (!payload.action || typeof payload.action !== 'string') {
        throw new Error('action is required')
      }
      if (!payload.accelerator || typeof payload.accelerator !== 'string') {
        throw new Error('accelerator is required')
      }
      const current = loadKeybindPreferences()
      const error = validateKeybindAssignment(payload.action, payload.accelerator, current)
      if (error) {
        throw new Error(error)
      }
      const next = { ...current, [payload.action]: payload.accelerator }
      const saved = saveKeybindPreferences(next)
      registerKeybinds(saved)
      return toPublicKeybindPreferences()
    },
  )

  registerValidatedHandler(
    'keybinds:reset-one',
    { requiresInput: true },
    (data) => {
      const payload = data as { action?: KeybindActionId }
      if (!payload.action || typeof payload.action !== 'string') {
        throw new Error('action is required')
      }
      const saved = resetKeybind(payload.action)
      registerKeybinds(saved)
      return toPublicKeybindPreferences()
    },
  )

  registerValidatedHandler('keybinds:reset-all', {}, () => {
    const saved = resetKeybindPreferences()
    registerKeybinds(saved)
    return toPublicKeybindPreferences()
  })

  const MEMORY_IPC_CHANNELS = [
    'memory:settings-get',
    'memory:settings-update',
    'memory:profile-get',
    'memory:profile-update',
    'memory:facts-list',
    'memory:fact-upsert',
    'memory:fact-delete',
    'memory:people-list',
    'memory:people-upsert',
    'memory:people-update',
    'memory:people-delete',
    'memory:pre-session-context',
    'memory:relationship-cards',
    'memory:action-items-list',
    'memory:action-item-complete',
    'memory:briefing-get',
    'memory:briefing-generate',
    'memory:briefing-dismiss',
    'memory:briefing-pin',
    'memory:calendar-status',
    'memory:calendar-connect',
    'memory:calendar-disconnect',
    'memory:calendar-events-today',
    'memory:feedback-record',
    'memory:learning-latest',
    'memory:export',
    'memory:clear-all',
    'memory:apply-retention',
  ] as const

  const PROACTIVE_IPC_CHANNELS = [
    'proactive:status',
    'proactive:settings-get',
    'proactive:settings-update',
    'proactive:enable',
    'proactive:disable',
    'proactive:suggestions-get',
    'proactive:dismiss',
    'proactive:run-action',
    'proactive:panel-close',
    'proactive:writing-transform',
    'proactive:summarise',
    'proactive:extract-actions',
    'proactive:draft-generate',
    'proactive:draft-export-gmail',
    'proactive:clipboard-get',
    'proactive:action-item-complete',
    'proactive:summarise-transcript',
    'proactive:clear-history',
  ] as const

  for (const channel of MEMORY_IPC_CHANNELS) {
    ipcMain.handle(channel, async (_event, data) => {
      const result = handleMemoryIpc(channel, data)
      return result instanceof Promise ? await result : result
    })
  }

  for (const channel of PROACTIVE_IPC_CHANNELS) {
    ipcMain.handle(channel, async (_event, data) => {
      const result = await handleProactiveIpc(channel, data)
      return result
    })
  }

  handlersRegistered = true
  startDictationTargetTracking()
}
