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
  getConnectPageUrl,
  getDashboardUrl,
  hasLocalDeviceCredentials,
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
  enqueueTranscription({ base64, source, enqueuedAt: Date.now(), rms })
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
    const url = getConnectPageUrl()
    if (isAllowedExternalUrl(url)) {
      await shell.openExternal(url)
    } else {
      console.warn('Blocked auth:open-connect to disallowed scheme:', url)
    }
    return { url }
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
    return { status: 'resumed', isPaused: getIsPaused() }
  })

  ipcMain.handle('audio:stop', async () => {
    stopSystemAudio()
    clearSystemCaptureActive()
    stopRecording()
    onSystemAudioData = null
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
    }
    saveAudioPreferences(next)
    return next
  })
}
