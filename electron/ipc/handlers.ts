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
  fetchDeviceProfileCached,
  getDashboardUrl,
  getPrivacyUrl,
  getSignInUrl,
  getTermsUrl,
  hasLocalDeviceCredentials,
  type DesktopAuthProvider,
} from '../deviceAuth'
import {
  createMeeting,
  deleteMeeting,
  getMeeting,
  listMeetings,
  updateMeeting,
  type StoredMeeting,
} from '../meetingStore'
import { enhanceMeetingNotes } from '../noteEnhance'
import {
  loadOnboardingState,
  markOnboardingComplete,
  saveOnboardingState,
} from '../onboardingState'
import {
  getPermissionStatus,
  openSystemAudioSettings,
  requestMicrophoneAccess,
} from '../permissions'
import {
  closeWidget,
  createOrShowWidget,
  hideWidget,
  setRecordingStartedAt,
} from '../recordingWidget'
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
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('transcript:update', {
        recent: sessionTranscriptEntries.slice(-12),
        full: sessionTranscriptEntries,
      })
    }
  }
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
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('transcription:activity', { state })
    }
  }
}

function enqueueAudioChunk(
  base64: string,
  source: TranscriptSource,
  rms?: number,
): void {
  enqueueTranscription(base64, source, rms)
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

  void enhanceMeetingNotes(meetingId).then((enhanced) => {
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

  ipcMain.handle('ping', () => 'pong')

  ipcMain.handle('auth:connection-status', async () => {
    const pairedLocally = await hasLocalDeviceCredentials()
    if (!pairedLocally) return { paired: false }
    const profile = await fetchDeviceProfileCached()
    return {
      paired: profile.paired,
      email: profile.email,
      plan: profile.plan,
      planLabel: profile.planLabel,
    }
  })

  ipcMain.handle('auth:open-connect', async () => {
    const url = getSignInUrl()
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

  ipcMain.handle('meetings:list', () => listMeetings())

  ipcMain.handle('meetings:get', (_event, id: unknown) => {
    if (typeof id !== 'string') return null
    return getMeeting(id)
  })

  ipcMain.handle('meetings:create', (_event, payload?: { title?: string }) => {
    const meeting = createMeeting(payload?.title)
    broadcastMeetingsChanged()
    return meeting
  })

  ipcMain.handle(
    'meetings:update',
    (_event, payload: { id?: string; title?: string; userNotes?: string }) => {
      if (!payload?.id) return null
      const patch: Partial<StoredMeeting> = {}
      if (typeof payload.title === 'string') patch.title = payload.title
      if (typeof payload.userNotes === 'string') patch.userNotes = payload.userNotes
      const updated = updateMeeting(payload.id, patch)
      if (updated) broadcastMeetingsChanged()
      return updated
    },
  )

  ipcMain.handle('meetings:delete', (_event, id: unknown) => {
    if (typeof id !== 'string') return { ok: false }
    const ok = deleteMeeting(id)
    if (ok) broadcastMeetingsChanged()
    return { ok }
  })

  ipcMain.handle('meetings:enhance', async (_event, id: unknown) => {
    if (typeof id !== 'string') return null
    const result = await enhanceMeetingNotes(id)
    broadcastMeetingsChanged()
    return result
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
      createOrShowWidget()

      return { status: 'started', meetingId: activeMeetingId }
    },
  )

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
    createOrShowWidget()
    return { status: 'resumed', isPaused: getIsPaused() }
  })

  ipcMain.handle('audio:stop', async () => {
    stopSystemAudio()
    clearSystemCaptureActive()
    stopRecording()
    onSystemAudioData = null
    setRecordingStartedAt(null)
    hideWidget()
    await flushTranscriptionQueue()
    clearTranscriptionQueue()
    await finalizeActiveMeeting()
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

  ipcMain.handle('widget:stop-recording', async () => {
    stopSystemAudio()
    clearSystemCaptureActive()
    stopRecording()
    onSystemAudioData = null
    setRecordingStartedAt(null)
    hideWidget()
    await flushTranscriptionQueue()
    clearTranscriptionQueue()
    await finalizeActiveMeeting()
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('audio:stopped')
      }
    }
    return { status: 'stopped' }
  })
}
