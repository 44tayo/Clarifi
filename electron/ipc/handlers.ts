import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { randomUUID } from 'crypto'

import {
  getIsPaused,
  getIsRecording,
  pauseRecording,
  resumeRecording,
  startRecording,
  stopRecording,
  transcribeDictationAudio,
  wavHasSpeechEnergy,
  wavRms,
} from '../audio'
import {
  getDictationEnabled,
  getMicSttEngine,
  loadAudioPreferences,
  saveAudioPreferences,
  type AudioPreferences,
} from '../audioPreferences'
import { applySpeakerIdentity } from '../../shared/speakers'
import {
  fetchCalendarEvents,
  fetchCalendarOAuthUrl,
  fetchCalendarStatus,
  disconnectCalendarProvider,
  invalidateCalendarContactsCache,
  searchCalendarContacts,
} from '../calendarClient'
import {
  acceptSharedInvite,
  getSharedWithMeItem,
  inviteToSharedMeeting,
  getMeetingShareAccess,
  listSharedWithMe,
  publishMeetingShare,
} from '../shareClient'
import { proxyMeetingChat } from '../proxyClient'
import { packMeetingsForChat } from '../../shared/chatContext'
import { resolveSpeakerDisplay } from '../transcriptUtils'
import { pushMeetingToCloud, deleteMeetingFromCloud, syncMeetingsWithCloud } from '../meetingSync'
import {
  fetchDeviceProfileCached,
  getConnectPageUrl,
  getCalendarConnectUrl,
  getDashboardUrl,
  getPrivacyUrl,
  getSignInUrl,
  getTermsUrl,
  hasLocalDeviceCredentials,
  type DesktopAuthProvider,
} from '../deviceAuth'
import {
  createFolder,
  createMeeting,
  deleteFolder,
  deleteMeeting,
  DEMO_ARTIFACT_MEETING_ID,
  ensureDemoArtifactMeeting,
  forgetDeletedMeetingIds,
  getMeeting,
  listAllTags,
  listFolders,
  listMeetings,
  renameFolder,
  setMeetingFolders,
  setMeetingTags,
  setMeetingTemplate,
  updateMeeting,
  type StoredMeeting,
} from '../meetingStore'
import { normalizeMeetingTemplateId } from '../../shared/meetingTemplates'
import {
  appendSystemWavChunk,
  deleteMeetingRecording,
  getSpeakerSnippetBase64,
  startMeetingRecording,
  stopMeetingRecording,
} from '../meetingRecording'
import {
  clearEnhanceRetry,
  flushEnhanceRetryQueue,
  queueEnhanceRetry,
  registerEnhanceRunner,
} from '../enhanceQueue'
import { enhanceMeetingNotes } from '../noteEnhance'
import { exportMeetingToFile } from '../meetingExport'
import { isProxyConfigured } from '../proxyClient'
import {
  loadOnboardingState,
  markOnboardingComplete,
  saveOnboardingState,
} from '../onboardingState'
import {
  getPermissionStatus,
  openMicrophoneSettings,
  openSystemAudioSettings,
  requestMicrophoneAccess,
} from '../permissions'
import {
  broadcastTranscriptInterimToWidget,
  broadcastTranscriptToWidget,
  closeWidget,
  createOrShowWidget,
  hideWidget,
  setActiveMeetingForWidget,
  setRecordingStartedAt,
  setWidgetActivity,
  setWidgetMode,
  setWidgetPanel,
  setWidgetPaused,
} from '../recordingWidget'
import type { WidgetPanel } from '../widgetBounds'
import { isAllowedExternalUrl } from '../urlSafety'
import {
  clearSystemCaptureActive,
  clearTranscriptionQueue,
  configureTranscriptionQueue,
  enqueueTranscription,
  flushTranscriptionQueue,
  markSystemCaptureActive,
  noteSystemAudioEnergy,
  type TranscriptionActivityState,
} from '../transcriptionQueue'
import { startSystemAudio, stopSystemAudio } from '../systemAudio'
import {
  listLocalSpeakerContacts,
  upsertLocalSpeakerContact,
} from '../speakerContacts'
import {
  isDuplicateAcrossStreams,
  isDuplicateOfRecent,
  normalizeTranscriptEntry,
  type TranscriptEntry,
  type TranscriptSource,
} from '../transcriptUtils'
import { DeepgramLiveSession, type LiveSpeakerState } from '../deepgramLive'

let handlersRegistered = false
let sessionTranscriptEntries: TranscriptEntry[] = []
let deepgramLive: DeepgramLiveSession | null = null
let systemAudioLive = false
let micDeepgramLive: DeepgramLiveSession | null = null
/** Preserved across pause/resume so Speaker N labels do not renumber mid-meeting. */
let systemSpeakerState: LiveSpeakerState | null = null
/** Mic engine actually in use for the active session (may differ from prefs after failover). */
let sessionMicEngine: 'deepgram' | 'whisper' = 'deepgram'

function stopDeepgramLive(options?: { preserveSpeakerState?: boolean }): void {
  if (deepgramLive && options?.preserveSpeakerState) {
    systemSpeakerState = deepgramLive.getSpeakerState()
  }
  const hadSession = Boolean(deepgramLive)
  deepgramLive?.stop()
  deepgramLive = null
  systemAudioLive = false
  if (hadSession) broadcastTranscriptInterim('system', null)
}

function stopMicDeepgramLive(): void {
  const hadSession = Boolean(micDeepgramLive)
  micDeepgramLive?.stop()
  micDeepgramLive = null
  if (hadSession) broadcastTranscriptInterim('mic', null)
}

async function beginSystemAudioCapture(): Promise<boolean> {
  stopDeepgramLive()

  const session = new DeepgramLiveSession({
    diarize: true,
    source: 'system',
    ...(systemSpeakerState ? { initialSpeakerState: systemSpeakerState } : {}),
    onInterim: (update) => broadcastTranscriptInterim('system', update),
    onFinal: (utterance) => {
      broadcastTranscriptInterim('system', null)
      systemSpeakerState = session.getSpeakerState()
      pushLiveTranscriptEntry({
        id: randomUUID(),
        text: utterance.text,
        source: 'system',
        speaker: utterance.speaker,
        at: Date.now(),
        audioStartMs: utterance.streamOffsetMs,
        audioEndMs: utterance.streamOffsetMs + Math.max(800, utterance.text.length * 40),
      })
      broadcastTranscriptionActivity('transcribing')
    },
    onError: (message) => {
      console.error('Deepgram live session error:', message)
    },
  })

  const liveOk = await session.start()
  if (liveOk) {
    deepgramLive = session
    systemAudioLive = true
    systemSpeakerState = session.getSpeakerState()
    console.log('System STT: Deepgram live nova-3 (Speaker 1/2/…)')
  } else {
    session.stop()
    console.warn('System STT: falling back to batch diarize queue (Deepgram live unavailable)')
  }

  const started = startSystemAudio({
    flushIntervalMs: systemAudioLive ? 200 : 1000,
    onPcm: systemAudioLive
      ? (pcm) => {
          deepgramLive?.sendPcm(pcm)
        }
      : undefined,
    onWav: (wavBuffer) => {
      const rms = wavRms(wavBuffer)
      const hadEnergy = wavHasSpeechEnergy(wavBuffer)
      noteSystemAudioEnergy(rms, hadEnergy)
      const audioOffsetMs = appendSystemWavChunk(wavBuffer)
      if (!systemAudioLive) {
        enqueueAudioChunk(
          wavBuffer.toString('base64'),
          'system',
          rms,
          audioOffsetMs ?? undefined,
        )
      }
    },
  })

  if (!started) {
    stopDeepgramLive()
    return false
  }

  markSystemCaptureActive()
  return true
}

async function beginMicDeepgramCapture(): Promise<boolean> {
  stopMicDeepgramLive()

  const session = new DeepgramLiveSession({
    diarize: false,
    source: 'mic',
    fixedSpeakerLabel: 'Me',
    onInterim: (update) => broadcastTranscriptInterim('mic', update),
    onFinal: (utterance) => {
      broadcastTranscriptInterim('mic', null)
      pushLiveTranscriptEntry({
        id: randomUUID(),
        text: utterance.text,
        source: 'mic',
        speaker: utterance.speaker,
        at: Date.now(),
        audioStartMs: utterance.streamOffsetMs,
        audioEndMs: utterance.streamOffsetMs + Math.max(800, utterance.text.length * 40),
      })
      broadcastTranscriptionActivity('transcribing')
    },
    onError: (message) => {
      console.error('Deepgram mic live session error:', message)
    },
  })

  const liveOk = await session.start()
  if (liveOk) {
    micDeepgramLive = session
    console.log('Mic STT: Deepgram live nova-3 (Me)')
    return true
  }
  session.stop()
  console.warn('Mic STT: Deepgram live unavailable — falling back to Whisper for this session')
  return false
}
let activeMeetingId: string | null = null
let resolveMainWindow: (() => BrowserWindow | null) | undefined

function broadcastMeetingsChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('meetings:changed')
    }
  }
}

function getMainWindow(
  getWindow?: () => BrowserWindow | null,
): BrowserWindow | null {
  const win = getWindow?.()
  if (win && !win.isDestroyed()) return win
  const focused = BrowserWindow.getFocusedWindow()
  if (focused && !focused.isDestroyed()) return focused
  const windows = BrowserWindow.getAllWindows()
  return windows.find((w) => !w.isDestroyed()) ?? null
}

function getSessionTranscriptEntries(): TranscriptEntry[] {
  return sessionTranscriptEntries
}

function broadcastTranscript(): void {
  const payload = {
    recent: sessionTranscriptEntries.slice(-12),
    full: sessionTranscriptEntries,
  }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('transcript:update', payload)
    }
  }
  broadcastTranscriptToWidget(payload)
}

function pushTranscriptEntry(entry: TranscriptEntry): void {
  sessionTranscriptEntries.push(normalizeTranscriptEntry(entry))
  broadcastTranscript()
}

/**
 * Broadcasts an in-progress (non-final) caption line for a live source, or
 * `null` to clear it. Kept separate from `sessionTranscriptEntries` since
 * interim text is transient and never persisted.
 */
function broadcastTranscriptInterim(
  source: TranscriptSource,
  update: { text: string; speaker: string } | null,
): void {
  const payload = { source, update }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('transcript:interim', payload)
    }
  }
  broadcastTranscriptInterimToWidget(payload)
}

/**
 * Live-STT entry point shared by the mic and system Deepgram sessions.
 * Replaces RMS-based bleed filtering with post-transcription text-similarity
 * dedup — if the same words show up on both streams within the window
 * (acoustic leak), only the first one to arrive is kept.
 */
function pushLiveTranscriptEntry(entry: TranscriptEntry): void {
  const normalized = normalizeTranscriptEntry(entry)
  if (!normalized.text) return
  if (
    isDuplicateOfRecent(normalized.text, sessionTranscriptEntries, 12_000, {
      speaker: normalized.speaker,
      source: normalized.source,
      at: normalized.at,
    })
  ) {
    return
  }
  if (
    isDuplicateAcrossStreams(
      normalized.text,
      sessionTranscriptEntries,
      normalized.at,
      normalized.source,
    )
  ) {
    return
  }
  pushTranscriptEntry(normalized)
}

function pruneTranscriptEntries(entryIds: string[]): void {
  if (entryIds.length === 0) return
  const remove = new Set(entryIds)
  sessionTranscriptEntries = sessionTranscriptEntries.filter((e) => !remove.has(e.id))
  broadcastTranscript()
}

function broadcastTranscriptionActivity(state: TranscriptionActivityState): void {
  setWidgetActivity(state)
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('transcription:activity', { state })
    }
  }
}

function broadcastToAllWindows(channel: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel)
    }
  }
}

async function abortCaptureSession(): Promise<void> {
  stopSystemAudio()
  stopDeepgramLive()
  stopMicDeepgramLive()
  systemSpeakerState = null
  sessionMicEngine = 'deepgram'
  clearSystemCaptureActive()
  stopRecording()
  setRecordingStartedAt(null)
  setWidgetPaused(false)
  closeWidget()
  clearTranscriptionQueue()
  sessionTranscriptEntries = []
  stopMeetingRecording()

  const main = getMainWindow(resolveMainWindow)
  if (main) {
    main.show()
    main.focus()
  }

  if (activeMeetingId) {
    deleteMeetingRecording(activeMeetingId)
    updateMeeting(activeMeetingId, {
      status: 'draft',
      startedAt: undefined,
      transcript: [],
      recordingPath: undefined,
    })
    broadcastMeetingsChanged()
    activeMeetingId = null
  }
}

function pauseCaptureSession(): void {
  pauseRecording()
  stopSystemAudio()
  stopDeepgramLive({ preserveSpeakerState: true })
  stopMicDeepgramLive()
  clearSystemCaptureActive()
  setWidgetPaused(true)
}

function resumeCaptureSession(): void {
  resumeRecording()
  if (process.platform === 'darwin') {
    void beginSystemAudioCapture()
  }
  setWidgetPaused(false)
  createOrShowWidget()
}

async function ensureSessionMicDeepgram(): Promise<void> {
  if (sessionMicEngine !== 'deepgram') return
  if (micDeepgramLive?.isOpen) return
  const ok = await beginMicDeepgramCapture()
  if (!ok) {
    sessionMicEngine = 'whisper'
    console.warn('Mic STT: Deepgram unavailable — session mic engine set to Whisper')
  }
}

async function finishRecordingSession(): Promise<StoredMeeting | null> {
  stopSystemAudio()
  stopDeepgramLive()
  stopMicDeepgramLive()
  systemSpeakerState = null
  clearSystemCaptureActive()
  stopRecording()
  setRecordingStartedAt(null)
  setWidgetPaused(false)
  closeWidget()

  const main = getMainWindow(resolveMainWindow)
  if (main) {
    main.show()
    main.focus()
  }

  await flushTranscriptionQueue()
  clearTranscriptionQueue()
  const recordingPath = stopMeetingRecording()
  const meeting = await finalizeActiveMeeting(recordingPath)
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('audio:stopped')
    }
  }
  return meeting
}

function enqueueAudioChunk(
  base64: string,
  source: TranscriptSource,
  rms?: number,
  audioOffsetMs?: number,
): void {
  enqueueTranscription(base64, source, rms, audioOffsetMs)
}

async function runMeetingEnhance(meetingId: string): Promise<StoredMeeting | null> {
  const enhanced = await enhanceMeetingNotes(meetingId)
  if (enhanced?.status === 'ready') {
    clearEnhanceRetry(meetingId)
    void pushMeetingToCloud(meetingId)
  } else if (enhanced?.status === 'error' && enhanced.enhanceError === 'network_error') {
    queueEnhanceRetry(meetingId)
  }
  return enhanced
}

async function finalizeActiveMeeting(recordingPath?: string | null): Promise<StoredMeeting | null> {
  if (!activeMeetingId) return null
  const meetingId = activeMeetingId
  activeMeetingId = null

  const meeting = updateMeeting(meetingId, {
    status: 'processing',
    endedAt: Date.now(),
    transcript: [...sessionTranscriptEntries],
    ...(recordingPath ? { recordingPath } : {}),
  })
  broadcastMeetingsChanged()

  if (!meeting) return null

  const configured = await isProxyConfigured()
  if (!configured) {
    const waiting = updateMeeting(meetingId, {
      status: 'error',
      enhanceError: 'Connect your account to generate your AI summary.',
    })
    broadcastMeetingsChanged()
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('meetings:needs-connect', { id: meetingId })
      }
    }
    return waiting
  }

  void runMeetingEnhance(meetingId).then((enhanced) => {
    broadcastMeetingsChanged()
    if (enhanced) {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('meetings:enhanced', { id: meetingId })
        }
      }
    }
  })

  return meeting
}

export function registerHandlers(getWindow?: () => BrowserWindow | null): void {
  if (handlersRegistered) return
  handlersRegistered = true
  resolveMainWindow = getWindow
  registerEnhanceRunner(runMeetingEnhance)

  ipcMain.handle('ping', () => 'pong')

  ipcMain.handle('auth:connection-status', async (_event, options?: { force?: boolean }) => {
    const pairedLocally = await hasLocalDeviceCredentials()
    if (!pairedLocally) return { paired: false }
    const force = options?.force === true
    const profile = await fetchDeviceProfileCached(force)
    return {
      paired: profile.paired,
      email: profile.email,
      plan: profile.plan,
      planLabel: profile.planLabel,
      trialEndsAt: profile.trialEndsAt ?? null,
      subscriptionStatus: profile.subscriptionStatus ?? null,
      trialActive: Boolean(profile.trialActive),
    }
  })

  ipcMain.handle('auth:open-connect', async () => {
    const url = getConnectPageUrl()
    if (isAllowedExternalUrl(url)) {
      await shell.openExternal(url)
    } else {
      console.warn('Blocked auth:open-connect to disallowed scheme:', url)
    }
    return { url }
  })

  ipcMain.handle('auth:open-sign-in', async (_event, provider?: unknown) => {
    const allowed: DesktopAuthProvider[] = ['google', 'azure', 'email']
    const selected =
      typeof provider === 'string' && (allowed as string[]).includes(provider)
        ? (provider as DesktopAuthProvider)
        : 'email'
    const url = getSignInUrl(selected)
    if (isAllowedExternalUrl(url)) {
      await shell.openExternal(url)
    } else {
      console.warn('Blocked auth:open-sign-in to disallowed scheme:', url)
    }
    return { url, provider: selected }
  })

  ipcMain.handle('auth:open-dashboard', async () => {
    const url = getDashboardUrl()
    if (isAllowedExternalUrl(url)) {
      await shell.openExternal(url)
    } else {
      console.warn('Blocked auth:open-dashboard to disallowed scheme:', url)
    }
    return { url }
  })

  ipcMain.handle('auth:open-legal', async (_event, page?: unknown) => {
    const url = page === 'privacy' ? getPrivacyUrl() : getTermsUrl()
    if (isAllowedExternalUrl(url)) {
      await shell.openExternal(url)
    } else {
      console.warn('Blocked auth:open-legal to disallowed scheme:', url)
    }
    return { url }
  })

  ipcMain.handle('calendar:open-meeting-url', async (_event, url?: unknown) => {
    if (typeof url !== 'string' || !isAllowedExternalUrl(url)) {
      return { ok: false }
    }
    await shell.openExternal(url)
    return { ok: true }
  })

  ipcMain.handle('calendar:status', async () => fetchCalendarStatus())

  ipcMain.handle('calendar:events', async () => fetchCalendarEvents())

  ipcMain.handle('calendar:contacts-search', async (_event, payload?: { query?: string }) => {
    const query = typeof payload?.query === 'string' ? payload.query : ''
    return searchCalendarContacts(query)
  })

  ipcMain.handle('calendar:contacts-invalidate', () => {
    invalidateCalendarContactsCache()
    return { ok: true }
  })

  ipcMain.handle('contacts:list-local', () => ({
    contacts: listLocalSpeakerContacts().map((c) => ({
      displayName: c.displayName,
      email: c.email,
      source: 'manual' as const,
    })),
  }))

  ipcMain.handle(
    'contacts:upsert',
    (_event, payload?: { displayName?: string; email?: string }) => {
      const displayName = typeof payload?.displayName === 'string' ? payload.displayName : ''
      const email = typeof payload?.email === 'string' ? payload.email : undefined
      const saved = upsertLocalSpeakerContact({ displayName, email })
      return { ok: Boolean(saved), contact: saved }
    },
  )

  ipcMain.handle('calendar:open-connect', async (_event, provider?: unknown) => {
    const selected = provider === 'microsoft' ? 'microsoft' : 'google'
    // Prefer a device-bound OAuth URL so calendar tokens save on the paired
    // account forever — not whatever browser user happens to be signed in.
    invalidateCalendarContactsCache()
    const bound = await fetchCalendarOAuthUrl(selected)
    const url = bound.ok && bound.authUrl ? bound.authUrl : getCalendarConnectUrl(selected)
    if (isAllowedExternalUrl(url)) {
      await shell.openExternal(url)
    } else {
      console.warn('Blocked calendar:open-connect to disallowed scheme:', url)
    }
    return { url, provider: selected, boundToDevice: Boolean(bound.ok && bound.authUrl) }
  })

  ipcMain.handle('calendar:disconnect', async (_event, provider?: unknown) => {
    const selected = provider === 'microsoft' ? 'microsoft' : 'google'
    invalidateCalendarContactsCache()
    return disconnectCalendarProvider(selected)
  })

  ipcMain.handle('meetings:list', () => {
    return listMeetings()
  })

  ipcMain.handle('meetings:seed-demo-artifact', () => {
    if (app.isPackaged) {
      return { ok: false, error: 'demo_disabled_in_production' }
    }
    forgetDeletedMeetingIds([DEMO_ARTIFACT_MEETING_ID])
    const result = ensureDemoArtifactMeeting()
    broadcastMeetingsChanged()
    return result
  })

  ipcMain.handle('meetings:get', (_event, id: unknown) => {
    if (typeof id !== 'string') return null
    return getMeeting(id)
  })

  ipcMain.handle('meetings:create', (_event, payload?: {
    title?: string
    calendarEventId?: string
    calendarProvider?: 'google' | 'microsoft'
    scheduledStart?: number
    attendeeEmails?: string[]
    attendees?: StoredMeeting['attendees']
    speakerLabels?: Record<string, string>
    speakerIdentities?: StoredMeeting['speakerIdentities']
    templateId?: StoredMeeting['templateId']
  }) => {
    const meeting = createMeeting(payload)
    broadcastMeetingsChanged()
    return meeting
  })

  ipcMain.handle(
    'meetings:update',
    (_event, payload: {
      id?: string
      title?: string
      userNotes?: string
      speakerLabels?: Record<string, string>
      speakerIdentities?: StoredMeeting['speakerIdentities']
      attendees?: StoredMeeting['attendees']
      attendeeEmails?: string[]
      actionItems?: string[]
      completedActionItems?: string[]
      enhancedNotes?: string
      evidenceCache?: Record<string, string>
    }) => {
      if (!payload?.id) return null
      const patch: Partial<StoredMeeting> = {}
      if (typeof payload.title === 'string') patch.title = payload.title
      if (typeof payload.userNotes === 'string') patch.userNotes = payload.userNotes
      if (typeof payload.enhancedNotes === 'string') patch.enhancedNotes = payload.enhancedNotes
      if (payload.evidenceCache && typeof payload.evidenceCache === 'object') {
        patch.evidenceCache = payload.evidenceCache
      }
      if (payload.speakerLabels && typeof payload.speakerLabels === 'object') {
        patch.speakerLabels = payload.speakerLabels
      }
      if (payload.speakerIdentities && typeof payload.speakerIdentities === 'object') {
        patch.speakerIdentities = payload.speakerIdentities
      }
      if (Array.isArray(payload.attendees)) {
        patch.attendees = payload.attendees
      }
      if (Array.isArray(payload.attendeeEmails)) {
        patch.attendeeEmails = payload.attendeeEmails.filter((item) => typeof item === 'string')
      }
      if (Array.isArray(payload.actionItems)) {
        patch.actionItems = payload.actionItems.filter((item) => typeof item === 'string')
      }
      if (Array.isArray(payload.completedActionItems)) {
        patch.completedActionItems = payload.completedActionItems.filter(
          (item) => typeof item === 'string',
        )
      }
      const updated = updateMeeting(payload.id, patch)
      if (updated) {
        broadcastMeetingsChanged()
        void pushMeetingToCloud(payload.id)
      }
      return updated
    },
  )

  ipcMain.handle('meetings:sync', async () => {
    const result = await syncMeetingsWithCloud()
    if (result.ok) broadcastMeetingsChanged()
    return result
  })

  ipcMain.handle('meetings:delete', (_event, id: unknown) => {
    if (typeof id !== 'string' || !id) return { ok: false }
    // Always tombstone + attempt cloud delete so sync cannot resurrect the note.
    deleteMeeting(id)
    deleteMeetingRecording(id)
    broadcastMeetingsChanged()
    void deleteMeetingFromCloud(id)
    return { ok: true }
  })

  ipcMain.handle(
    'meetings:speaker-snippet',
    (_event, payload?: { meetingId?: string; speaker?: string }) => {
      const meetingId = payload?.meetingId
      const speaker = payload?.speaker
      if (!meetingId || !speaker) return { ok: false, error: 'missing_params' }

      const meeting = getMeeting(meetingId)
      const hasRecording = Boolean(meeting?.recordingPath) || meetingId === activeMeetingId
      if (!meeting || !hasRecording) return { ok: false, error: 'no_recording' }

      const transcript =
        meetingId === activeMeetingId && sessionTranscriptEntries.length > 0
          ? sessionTranscriptEntries
          : meeting.transcript

      const entry =
        transcript.find(
          (row) => row.speaker === speaker && typeof row.audioStartMs === 'number',
        ) ?? transcript.find((row) => row.speaker === speaker)

      if (!entry) return { ok: false, error: 'no_speaker' }

      const startMs =
        typeof entry.audioStartMs === 'number'
          ? entry.audioStartMs
          : Math.max(0, entry.at - (meeting.startedAt ?? entry.at))

      const durationMs =
        typeof entry.audioEndMs === 'number' && entry.audioEndMs > startMs
          ? Math.min(5000, entry.audioEndMs - startMs + 400)
          : 5000

      const audioBase64 = getSpeakerSnippetBase64(meetingId, startMs, durationMs)
      if (!audioBase64) return { ok: false, error: 'slice_failed' }
      return { ok: true, audioBase64, mimeType: 'audio/wav' }
    },
  )

  ipcMain.handle('meetings:enhance', async (_event, id: unknown) => {
    if (typeof id !== 'string') return null
    const result = await runMeetingEnhance(id)
    broadcastMeetingsChanged()
    return result
  })

  ipcMain.handle('folders:list', () => listFolders())

  ipcMain.handle('folders:create', (_event, name?: unknown) => {
    const folder = createFolder(typeof name === 'string' ? name : 'Untitled folder')
    broadcastMeetingsChanged()
    return folder
  })

  ipcMain.handle('folders:rename', (_event, payload?: { id?: string; name?: string }) => {
    if (!payload?.id || typeof payload.name !== 'string') return null
    const folder = renameFolder(payload.id, payload.name)
    if (folder) broadcastMeetingsChanged()
    return folder
  })

  ipcMain.handle('folders:delete', (_event, id?: unknown) => {
    if (typeof id !== 'string') return { ok: false }
    const ok = deleteFolder(id)
    if (ok) broadcastMeetingsChanged()
    return { ok }
  })

  ipcMain.handle(
    'meetings:set-folders',
    (_event, payload?: { id?: string; folderIds?: string[] }) => {
      if (!payload?.id || !Array.isArray(payload.folderIds)) return null
      const folderIds = payload.folderIds.filter((value): value is string => typeof value === 'string')
      const updated = setMeetingFolders(payload.id, folderIds)
      if (updated) broadcastMeetingsChanged()
      return updated
    },
  )

  ipcMain.handle(
    'meetings:export',
    async (_event, payload?: { meetingId?: string; format?: 'markdown' | 'pdf' }) => {
      if (!payload?.meetingId) return { ok: false, error: 'meeting_required' }
      const format = payload.format === 'pdf' ? 'pdf' : 'markdown'
      return exportMeetingToFile(payload.meetingId, format)
    },
  )

  ipcMain.handle('tags:list-all', () => listAllTags())

  ipcMain.handle(
    'meetings:set-tags',
    (_event, payload?: { id?: string; tags?: string[] }) => {
      if (!payload?.id || !Array.isArray(payload.tags)) return null
      const tags = payload.tags.filter((value): value is string => typeof value === 'string')
      const updated = setMeetingTags(payload.id, tags)
      if (updated) broadcastMeetingsChanged()
      return updated
    },
  )

  ipcMain.handle(
    'meetings:set-template',
    (_event, payload?: { id?: string; templateId?: string }) => {
      if (!payload?.id) return null
      const templateId = normalizeMeetingTemplateId(payload.templateId)
      const updated = setMeetingTemplate(payload.id, templateId)
      if (updated) broadcastMeetingsChanged()
      return updated
    },
  )

  ipcMain.handle(
    'share:publish',
    async (_event, payload?: { meetingId?: string; linkAccess?: 'anyone' | 'invited' }) => {
      if (!payload?.meetingId) return { ok: false, error: 'meeting_required' }
      return publishMeetingShare(
        payload.meetingId,
        payload.linkAccess === 'invited' ? 'invited' : 'anyone',
      )
    },
  )

  ipcMain.handle('share:access', async (_event, payload?: { meetingId?: string }) => {
    if (!payload?.meetingId) return { ok: false, error: 'meeting_required' }
    return getMeetingShareAccess(payload.meetingId)
  })

  ipcMain.handle(
    'share:invite',
    async (_event, payload?: { communityId?: string; email?: string; meetingId?: string }) => {
      if (
        !payload?.communityId ||
        typeof payload.email !== 'string' ||
        typeof payload.meetingId !== 'string'
      ) {
        return { ok: false, error: 'invalid_payload' }
      }
      return inviteToSharedMeeting(payload.communityId, payload.email, payload.meetingId)
    },
  )

  ipcMain.handle('share:list-shared', async () => listSharedWithMe())

  ipcMain.handle(
    'share:get-item',
    async (_event, payload?: { communityId?: string; itemId?: string }) => {
      if (!payload?.communityId || !payload?.itemId) {
        return { ok: false, error: 'invalid_payload' }
      }
      return getSharedWithMeItem(payload.communityId, payload.itemId)
    },
  )

  ipcMain.handle('share:accept-invite', async (_event, payload?: { token?: string }) => {
    if (!payload?.token || typeof payload.token !== 'string') {
      return { ok: false, error: 'token_required' }
    }
    return acceptSharedInvite(payload.token)
  })

  ipcMain.handle(
    'chat:send',
    async (
      _event,
      payload?: {
        message?: string
        meetingId?: string | null
        scope?: 'meeting' | 'all'
        model?: string
        effort?: 'low' | 'medium' | 'max'
        images?: Array<{
          imageBase64: string
          mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'
        }>
      },
    ) => {
      const message = typeof payload?.message === 'string' ? payload.message.trim() : ''
      if (!message) return { error: 'message_required' }

      const model = typeof payload?.model === 'string' ? payload.model.trim() : undefined
      const effort =
        payload?.effort === 'low' || payload?.effort === 'max' || payload?.effort === 'medium'
          ? payload.effort
          : 'medium'
      const images = Array.isArray(payload?.images)
        ? payload.images.filter(
            (image) =>
              image &&
              typeof image.imageBase64 === 'string' &&
              image.imageBase64.length > 0 &&
              typeof image.mimeType === 'string',
          ).slice(0, 6)
        : []

      const scope = payload?.scope === 'all' ? 'all' : 'meeting'
      if (scope === 'all') {
        const packed = packMeetingsForChat(
          listMeetings().map((meeting) => ({
            id: meeting.id,
            title: meeting.title,
            summary: meeting.summary,
            enhancedNotes: meeting.enhancedNotes,
            userNotes: meeting.userNotes,
            startedAt: meeting.startedAt,
            createdAt: meeting.createdAt,
          })),
        )
        if (!packed) {
          return proxyMeetingChat({
            message: `${message}\n\n(No local meetings available for context.)`,
            transcriptLines: [],
            model,
            effort,
            images,
          })
        }
        const enriched = `${packed}\n\nUser question:\n${message}`
        return proxyMeetingChat({ message: enriched, transcriptLines: [], model, effort, images })
      }

      let transcriptLines: string[] = []
      const meetingId = payload?.meetingId
      if (typeof meetingId === 'string' && meetingId) {
        const meeting = getMeeting(meetingId)
        if (meeting) {
          const labels = meeting.speakerLabels ?? {}
          transcriptLines = meeting.transcript.map(
            (entry) => `${resolveSpeakerDisplay(entry.speaker, labels)}: ${entry.text}`,
          )
          const contextBits = [
            `Meeting title: ${meeting.title}`,
            meeting.summary ? `Summary: ${meeting.summary}` : null,
            meeting.userNotes?.trim() ? `User notes:\n${meeting.userNotes.trim()}` : null,
          ].filter(Boolean)
          const enriched = [...contextBits, '', message].join('\n')
          return proxyMeetingChat({
            message: enriched,
            transcriptLines,
            model,
            effort,
            images,
          })
        }
      }

      return proxyMeetingChat({ message, transcriptLines, model, effort, images })
    },
  )

  ipcMain.handle('error:report', (_event, payload?: { message?: string; stack?: string }) => {
    const message = payload?.message ?? 'renderer_error'
    console.error('Renderer error report:', message, payload?.stack)
    return { ok: true }
  })

  ipcMain.handle('enhance:retry-pending', async () => {
    await flushEnhanceRetryQueue(runMeetingEnhance)
    broadcastMeetingsChanged()
    return { ok: true }
  })

  ipcMain.handle('audio:session-transcript', () => sessionTranscriptEntries)

  ipcMain.handle(
    'audio:start',
    async (_event, payload?: { meetingId?: string }) => {
      sessionTranscriptEntries = []
      clearTranscriptionQueue()
      systemSpeakerState = null

      if (payload?.meetingId) {
        activeMeetingId = payload.meetingId
        const recordingPath = startMeetingRecording(payload.meetingId)
        updateMeeting(payload.meetingId, {
          status: 'live',
          startedAt: Date.now(),
          transcript: [],
          recordingPath,
        })
        broadcastMeetingsChanged()
      }

      configureTranscriptionQueue({
        getEntries: getSessionTranscriptEntries,
        onEntry: pushTranscriptEntry,
        onPruneEntries: pruneTranscriptEntries,
        onActivity: broadcastTranscriptionActivity,
      })

      const win = getMainWindow(getWindow)
      if (win) {
        win.webContents.send('transcript:update', { recent: [], full: [] })
      }

      startRecording(() => {
        // Transcripts arrive via the transcription queue / Deepgram live.
      })

      if (process.platform === 'darwin') {
        await beginSystemAudioCapture()
      }

      const preferDeepgram = getMicSttEngine() !== 'whisper'
      sessionMicEngine = preferDeepgram ? 'deepgram' : 'whisper'
      if (preferDeepgram) {
        const liveOk = await beginMicDeepgramCapture()
        if (!liveOk) {
          sessionMicEngine = 'whisper'
        }
      }

      setRecordingStartedAt(Date.now())
      setActiveMeetingForWidget(activeMeetingId)
      setWidgetMode('compact')
      setWidgetPaused(false)
      createOrShowWidget()

      const mainWin = getMainWindow(getWindow)
      if (mainWin) {
        mainWin.hide()
      }

      return {
        status: 'started',
        meetingId: activeMeetingId,
        micEngine: sessionMicEngine,
      }
    },
  )

  ipcMain.handle('audio:pause', () => {
    pauseCaptureSession()
    return { status: 'paused', isPaused: getIsPaused(), micEngine: sessionMicEngine }
  })

  ipcMain.handle('audio:resume', async () => {
    resumeCaptureSession()
    await ensureSessionMicDeepgram()
    return { status: 'resumed', isPaused: getIsPaused(), micEngine: sessionMicEngine }
  })

  ipcMain.handle('audio:stop', async (_event, payload?: { abort?: boolean }) => {
    if (payload?.abort) {
      await abortCaptureSession()
      return { status: 'aborted' }
    }
    await finishRecordingSession()
    return { status: 'stopped' }
  })

  ipcMain.handle('audio:status', () => ({
    isRecording: getIsRecording(),
    isPaused: getIsPaused(),
    meetingId: activeMeetingId,
    micEngine: sessionMicEngine,
  }))

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

  ipcMain.handle(
    'audio:mic-pcm-chunk',
    (_event, payload?: { base64?: string }) => {
      const base64 = payload?.base64
      if (typeof base64 === 'string' && base64.length > 0 && micDeepgramLive) {
        micDeepgramLive.sendPcm(Buffer.from(base64, 'base64'))
      }
      return { status: 'queued' }
    },
  )

  ipcMain.handle('audio:get-preferences', () => loadAudioPreferences())

  ipcMain.handle('audio:set-preferences', (_event, payload: Partial<AudioPreferences>) => {
    const current = loadAudioPreferences()
    const next: AudioPreferences = {
      ...current,
      ...(typeof payload?.transcriptionLanguage === 'string'
        ? { transcriptionLanguage: payload.transcriptionLanguage }
        : {}),
      ...(typeof payload?.outputLanguage === 'string'
        ? { outputLanguage: payload.outputLanguage }
        : {}),
      ...(typeof payload?.dictationLanguage === 'string'
        ? { dictationLanguage: payload.dictationLanguage }
        : {}),
      ...(typeof payload?.dictationOutputLanguage === 'string'
        ? { dictationOutputLanguage: payload.dictationOutputLanguage }
        : {}),
      ...(typeof payload?.preferredMicrophoneId === 'string'
        ? { preferredMicrophoneId: payload.preferredMicrophoneId }
        : {}),
      ...(typeof payload?.preferredMicrophoneLabel === 'string'
        ? { preferredMicrophoneLabel: payload.preferredMicrophoneLabel }
        : {}),
      ...(payload?.systemAudioCapture === 'meeting' || payload?.systemAudioCapture === 'display'
        ? { systemAudioCapture: payload.systemAudioCapture }
        : {}),
      ...(typeof payload?.skipMicPicker === 'boolean'
        ? { skipMicPicker: payload.skipMicPicker }
        : {}),
      ...(payload?.theme === 'light' || payload?.theme === 'dark' || payload?.theme === 'system'
        ? { theme: payload.theme }
        : {}),
      ...(typeof payload?.meetingRemindersEnabled === 'boolean'
        ? { meetingRemindersEnabled: payload.meetingRemindersEnabled }
        : {}),
      ...(payload?.micSttEngine === 'whisper' || payload?.micSttEngine === 'deepgram'
        ? { micSttEngine: payload.micSttEngine }
        : {}),
    }
    saveAudioPreferences(next)
    return next
  })

  ipcMain.handle('audio:list-microphones', async () => {
    // Renderer enumerates devices via navigator.mediaDevices; this channel
    // exists so Settings can refresh after permission grants on macOS.
    return getPermissionStatus()
  })

  ipcMain.handle(
    'dictation:transcribe',
    async (
      _event,
      payload?: { audioBase64?: string; format?: 'wav' | 'webm' },
    ): Promise<{ text?: string; error?: string }> => {
      if (!getDictationEnabled()) {
        return { error: 'dictation_disabled' }
      }
      const audioBase64 = typeof payload?.audioBase64 === 'string' ? payload.audioBase64 : ''
      if (!audioBase64) return { error: 'audio_required' }
      try {
        // Format is sniffed from the buffer inside transcribeAudioBuffer.
        const text = await transcribeDictationAudio(audioBase64)
        if (!text) return { error: 'transcribe_failed' }
        return { text }
      } catch (err) {
        console.error('dictation:transcribe failed', err)
        return { error: 'transcribe_failed' }
      }
    },
  )

  ipcMain.handle('onboarding:get', () => loadOnboardingState())

  ipcMain.handle('onboarding:save', (_event, patch: Record<string, unknown>) => {
    return saveOnboardingState({
      ...(typeof patch?.welcomeSeen === 'boolean' ? { welcomeSeen: patch.welcomeSeen } : {}),
      ...(typeof patch?.permissionsSeen === 'boolean'
        ? { permissionsSeen: patch.permissionsSeen }
        : {}),
      ...(typeof patch?.completed === 'boolean' ? { completed: patch.completed } : {}),
    })
  })

  ipcMain.handle('onboarding:complete', () => markOnboardingComplete())

  ipcMain.handle('permissions:status', () => getPermissionStatus())

  ipcMain.handle('permissions:request-microphone', () => requestMicrophoneAccess())

  ipcMain.handle('permissions:open-microphone-settings', () => openMicrophoneSettings())

  ipcMain.handle('permissions:open-system-audio-settings', () => openSystemAudioSettings())

  ipcMain.handle('widget:show', () => {
    createOrShowWidget()
    return { ok: true }
  })

  ipcMain.handle('widget:hide', () => {
    hideWidget()
    return { ok: true }
  })

  ipcMain.handle('widget:close', () => {
    closeWidget()
    return { ok: true }
  })

  ipcMain.handle('widget:focus-main', () => {
    const win = getMainWindow(getWindow)
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
    return { ok: true }
  })

  ipcMain.handle('widget:open-meeting', () => {
    const win = getMainWindow(getWindow)
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
      if (activeMeetingId) {
        win.webContents.send('widget:navigate-meeting', { meetingId: activeMeetingId })
      }
    }
    setWidgetMode('compact')
    return { ok: true, meetingId: activeMeetingId }
  })

  ipcMain.handle('widget:expand', () => {
    setWidgetMode('expanded')
    return { ok: true }
  })

  ipcMain.handle('widget:collapse', () => {
    setWidgetMode('compact')
    return { ok: true }
  })

  ipcMain.handle('widget:set-panel', (_event, payload?: { panel?: string }) => {
    const panel: WidgetPanel = payload?.panel === 'transcript' ? 'transcript' : 'notepad'
    setWidgetPanel(panel)
    return { ok: true, panel }
  })

  ipcMain.handle('widget:get-session', () => {
    if (!activeMeetingId) {
      return {
        title: 'Meeting note',
        userNotes: '',
        transcript: sessionTranscriptEntries,
        speakerLabels: {},
      }
    }
    const meeting = getMeeting(activeMeetingId)
    return {
      title: meeting?.title ?? 'Meeting note',
      userNotes: meeting?.userNotes ?? '',
      transcript: sessionTranscriptEntries,
      speakerLabels: meeting?.speakerLabels ?? {},
    }
  })

  ipcMain.handle('widget:update-notes', (_event, payload?: { userNotes?: string }) => {
    if (!activeMeetingId || typeof payload?.userNotes !== 'string') return { ok: false }
    updateMeeting(activeMeetingId, { userNotes: payload.userNotes })
    broadcastMeetingsChanged()
    return { ok: true }
  })

  ipcMain.handle(
    'widget:rename-speaker',
    (_event, payload?: { speaker?: string; name?: string }) => {
      if (!activeMeetingId || !payload?.speaker || !payload?.name) return { ok: false }
      const meeting = getMeeting(activeMeetingId)
      if (!meeting) return { ok: false }
      const next = applySpeakerIdentity(
        meeting.speakerIdentities,
        meeting.speakerLabels,
        payload.speaker,
        { displayName: payload.name, source: 'manual' },
      )
      updateMeeting(activeMeetingId, next)
      broadcastMeetingsChanged()
      return { ok: true, speakerLabels: next.speakerLabels }
    },
  )

  ipcMain.handle('widget:stop-recording', async () => {
    await finishRecordingSession()
    return { status: 'stopped' }
  })

  ipcMain.handle('widget:pause-recording', () => {
    pauseCaptureSession()
    broadcastToAllWindows('audio:session-paused')
    return { status: 'paused', isPaused: getIsPaused() }
  })

  ipcMain.handle('widget:resume-recording', async () => {
    resumeCaptureSession()
    await ensureSessionMicDeepgram()
    broadcastToAllWindows('audio:session-resumed')
    return { status: 'resumed', isPaused: getIsPaused(), micEngine: sessionMicEngine }
  })
}
