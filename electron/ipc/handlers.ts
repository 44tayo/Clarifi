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
import {
  loadAudioPreferences,
  saveAudioPreferences,
  type AudioPreferences,
} from '../audioPreferences'
import {
  fetchCalendarEvents,
  fetchCalendarOAuthUrl,
  fetchCalendarStatus,
  disconnectCalendarProvider,
} from '../calendarClient'
import {
  acceptSharedInvite,
  getSharedWithMeItem,
  inviteToSharedMeeting,
  listSharedWithMe,
  publishMeetingShare,
} from '../shareClient'
import { proxyMeetingChat } from '../proxyClient'
import { packMeetingsForChat } from '../../shared/chatContext'
import { resolveSpeakerDisplay } from '../transcriptUtils'
import { pushMeetingToCloud, syncMeetingsWithCloud } from '../meetingSync'
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
  ensureDemoArtifactMeeting,
  getMeeting,
  listFolders,
  listMeetings,
  renameFolder,
  setMeetingFolders,
  updateMeeting,
  type StoredMeeting,
} from '../meetingStore'
import {
  clearEnhanceRetry,
  flushEnhanceRetryQueue,
  queueEnhanceRetry,
  registerEnhanceRunner,
} from '../enhanceQueue'
import { enhanceMeetingNotes } from '../noteEnhance'
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
  normalizeTranscriptEntry,
  type TranscriptEntry,
  type TranscriptSource,
} from '../transcriptUtils'

let handlersRegistered = false
let sessionTranscriptEntries: TranscriptEntry[] = []
let onSystemAudioData: ((wavBuffer: Buffer) => void) | null = null
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
  clearSystemCaptureActive()
  stopRecording()
  onSystemAudioData = null
  setRecordingStartedAt(null)
  setWidgetPaused(false)
  closeWidget()
  clearTranscriptionQueue()
  sessionTranscriptEntries = []

  const main = getMainWindow(resolveMainWindow)
  if (main) {
    main.show()
    main.focus()
  }

  if (activeMeetingId) {
    updateMeeting(activeMeetingId, {
      status: 'draft',
      startedAt: undefined,
      transcript: [],
    })
    broadcastMeetingsChanged()
    activeMeetingId = null
  }
}

function pauseCaptureSession(): void {
  pauseRecording()
  stopSystemAudio()
  clearSystemCaptureActive()
  setWidgetPaused(true)
}

function resumeCaptureSession(): void {
  resumeRecording()
  if (process.platform === 'darwin' && onSystemAudioData) {
    if (startSystemAudio(onSystemAudioData)) {
      markSystemCaptureActive()
    }
  }
  setWidgetPaused(false)
  createOrShowWidget()
}

async function finishRecordingSession(): Promise<StoredMeeting | null> {
  stopSystemAudio()
  clearSystemCaptureActive()
  stopRecording()
  onSystemAudioData = null
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
  const meeting = await finalizeActiveMeeting()
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
): void {
  enqueueTranscription(base64, source, rms)
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

async function finalizeActiveMeeting(): Promise<StoredMeeting | null> {
  if (!activeMeetingId) return null
  const meetingId = activeMeetingId
  activeMeetingId = null

  const meeting = updateMeeting(meetingId, {
    status: 'processing',
    endedAt: Date.now(),
    transcript: [...sessionTranscriptEntries],
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

  ipcMain.handle('calendar:status', async () => fetchCalendarStatus())

  ipcMain.handle('calendar:events', async () => fetchCalendarEvents())

  ipcMain.handle('calendar:open-connect', async (_event, provider?: unknown) => {
    const selected = provider === 'microsoft' ? 'microsoft' : 'google'
    // Prefer a device-bound OAuth URL so calendar tokens save on the paired
    // account forever — not whatever browser user happens to be signed in.
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
    return disconnectCalendarProvider(selected)
  })

  ipcMain.handle('meetings:list', () => {
    ensureDemoArtifactMeeting()
    return listMeetings()
  })

  ipcMain.handle('meetings:seed-demo-artifact', () => {
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
    speakerLabels?: Record<string, string>
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
      actionItems?: string[]
      completedActionItems?: string[]
    }) => {
      if (!payload?.id) return null
      const patch: Partial<StoredMeeting> = {}
      if (typeof payload.title === 'string') patch.title = payload.title
      if (typeof payload.userNotes === 'string') patch.userNotes = payload.userNotes
      if (payload.speakerLabels && typeof payload.speakerLabels === 'object') {
        patch.speakerLabels = payload.speakerLabels
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
    if (typeof id !== 'string') return { ok: false }
    const ok = deleteMeeting(id)
    if (ok) broadcastMeetingsChanged()
    return { ok }
  })

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

  ipcMain.handle('share:publish', async (_event, payload?: { meetingId?: string }) => {
    if (!payload?.meetingId) return { ok: false, error: 'meeting_required' }
    return publishMeetingShare(payload.meetingId)
  })

  ipcMain.handle(
    'share:invite',
    async (_event, payload?: { communityId?: string; email?: string }) => {
      if (!payload?.communityId || typeof payload.email !== 'string') {
        return { ok: false, error: 'invalid_payload' }
      }
      return inviteToSharedMeeting(payload.communityId, payload.email)
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

      if (payload?.meetingId) {
        activeMeetingId = payload.meetingId
        updateMeeting(payload.meetingId, {
          status: 'live',
          startedAt: Date.now(),
          transcript: [],
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
        // Transcripts arrive via the transcription queue.
      })

      if (process.platform === 'darwin') {
        onSystemAudioData = (wavBuffer: Buffer) => {
          const rms = wavRms(wavBuffer)
          const hadEnergy = wavHasSpeechEnergy(wavBuffer)
          noteSystemAudioEnergy(rms, hadEnergy)
          enqueueAudioChunk(wavBuffer.toString('base64'), 'system', rms)
        }
        if (startSystemAudio(onSystemAudioData)) {
          markSystemCaptureActive()
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

      return { status: 'started', meetingId: activeMeetingId }
    },
  )

  ipcMain.handle('audio:pause', () => {
    pauseCaptureSession()
    return { status: 'paused', isPaused: getIsPaused() }
  })

  ipcMain.handle('audio:resume', () => {
    resumeCaptureSession()
    return { status: 'resumed', isPaused: getIsPaused() }
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
      ...(payload?.transcriptionMode === 'auto' ||
      payload?.transcriptionMode === 'dual' ||
      payload?.transcriptionMode === 'group'
        ? { transcriptionMode: payload.transcriptionMode }
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
    }
    saveAudioPreferences(next)
    return next
  })

  ipcMain.handle('audio:list-microphones', async () => {
    // Renderer enumerates devices via navigator.mediaDevices; this channel
    // exists so Settings can refresh after permission grants on macOS.
    return getPermissionStatus()
  })

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
      const speakerLabels = {
        ...(meeting.speakerLabels ?? {}),
        [payload.speaker]: payload.name.trim(),
      }
      updateMeeting(activeMeetingId, { speakerLabels })
      broadcastMeetingsChanged()
      return { ok: true, speakerLabels }
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

  ipcMain.handle('widget:resume-recording', () => {
    resumeCaptureSession()
    broadcastToAllWindows('audio:session-resumed')
    return { status: 'resumed', isPaused: getIsPaused() }
  })
}
