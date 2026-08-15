import { app, BrowserWindow } from 'electron'
import { spawn, type ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

import type { CalendarEvent } from '../shared/calendar'
import {
  buildDetectedMeetingPayload,
  decideDetectionTick,
  type DetectedMeetingLabel,
  type DetectedMeetingPayload,
  type MicMonitorSnapshot,
} from '../shared/meetingDetection'
import { loadAudioPreferences, saveAudioPreferences } from './audioPreferences'
import { getIsRecording } from './audio'
import { fetchCalendarEvents } from './calendarClient'
import {
  clearPendingDetectionPayload,
  closeDetectionBanner,
  registerDetectionBannerIpc,
  showDetectionBanner,
} from './detectionBanner'
import { syncMeetingDetectionLoginItem } from './loginItem'

const CLARIFI_BUNDLES = new Set([
  'com.clarifi.desktop',
  'com.github.Electron',
  'electron',
])

let helperProcess: ChildProcess | null = null
let latestSnapshot: MicMonitorSnapshot = { inUse: false, pids: [], bundleIds: [] }
let micActiveSinceMs: number | null = null
let lastIdleAtMs: number | null = null
let promptedThisSession = false
let tickTimer: ReturnType<typeof setInterval> | null = null
let getWindow: (() => BrowserWindow | null) | null = null
let ensureWindow: (() => BrowserWindow | null) | null = null
let stdoutBuf = ''

function helperPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'mic-monitor-helper')
    : path.join(process.cwd(), 'resources', 'mic-monitor-helper')
}

function sanitizeSnapshot(raw: MicMonitorSnapshot): MicMonitorSnapshot {
  const bundleIds = (raw.bundleIds ?? []).filter((id) => !CLARIFI_BUNDLES.has(id))
  return {
    inUse: Boolean(raw.inUse),
    pids: Array.isArray(raw.pids) ? raw.pids.map(Number).filter((n) => Number.isFinite(n)) : [],
    bundleIds,
  }
}

function parseSnapshotLine(line: string): MicMonitorSnapshot | null {
  try {
    const parsed = JSON.parse(line) as MicMonitorSnapshot
    return sanitizeSnapshot(parsed)
  } catch {
    return null
  }
}

async function loadCalendarEvents(): Promise<CalendarEvent[]> {
  try {
    const { connected, events } = await fetchCalendarEvents()
    return connected ? events : []
  } catch {
    return []
  }
}

function showMainWindow(): BrowserWindow | null {
  const win = ensureWindow?.() ?? getWindow?.()
  if (!win || win.isDestroyed()) return null
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  return win
}

function broadcastTakeNotes(payload: DetectedMeetingPayload): void {
  const win = showMainWindow()
  if (!win) return
  const send = () => {
    if (!win.isDestroyed()) win.webContents.send('meeting:detection-start', payload)
  }
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', send)
  } else {
    send()
  }
}

function openClarifiApp(): void {
  showMainWindow()
}

function openClarifiSettings(): void {
  const win = showMainWindow()
  if (!win) return
  const send = () => {
    if (!win.isDestroyed()) win.webContents.send('tray:open-settings')
  }
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', send)
  } else {
    send()
  }
}

function muteDetectionForApp(payload: DetectedMeetingPayload): void {
  const key = payload.bundleId?.trim()
  if (!key) return
  const current = loadAudioPreferences()
  if (current.meetingDetectionMutedBundleIds.includes(key)) return
  saveAudioPreferences({
    ...current,
    meetingDetectionMutedBundleIds: [...current.meetingDetectionMutedBundleIds, key],
  })
}

async function onPrompt(label: DetectedMeetingLabel): Promise<void> {
  const events = await loadCalendarEvents()
  const payload = buildDetectedMeetingPayload(label, events, Date.now())
  showDetectionBanner(payload)
}

async function tick(): Promise<void> {
  if (process.platform !== 'darwin') return
  if (!loadAudioPreferences().meetingDetectionEnabled) {
    closeDetectionBanner()
    return
  }

  const suppress = getIsRecording()
  if (suppress) closeDetectionBanner()

  const { decision, ...next } = decideDetectionTick({
    snapshot: latestSnapshot,
    nowMs: Date.now(),
    micActiveSinceMs,
    lastIdleAtMs,
    promptedThisSession,
    suppress,
    mutedBundleIds: loadAudioPreferences().meetingDetectionMutedBundleIds,
  })
  micActiveSinceMs = next.micActiveSinceMs
  lastIdleAtMs = next.lastIdleAtMs
  promptedThisSession = next.promptedThisSession

  if (decision.action === 'prompt') {
    await onPrompt(decision.label)
  }
}

function startHelper(): void {
  if (process.platform !== 'darwin') return
  const bin = helperPath()
  if (!fs.existsSync(bin)) {
    console.warn('Mic monitor helper not found at', bin)
    return
  }
  if (helperProcess) return

  helperProcess = spawn(bin, [], { stdio: ['ignore', 'pipe', 'pipe'] })
  helperProcess.stderr?.on('data', (chunk: Buffer) => {
    console.log('Mic monitor:', chunk.toString().trim())
  })
  helperProcess.stdout?.on('data', (chunk: Buffer) => {
    stdoutBuf += chunk.toString('utf8')
    const parts = stdoutBuf.split('\n')
    stdoutBuf = parts.pop() ?? ''
    for (const line of parts) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const snap = parseSnapshotLine(trimmed)
      if (snap) latestSnapshot = snap
    }
  })
  helperProcess.on('exit', () => {
    helperProcess = null
  })
  helperProcess.on('error', (err) => {
    console.error('Mic monitor helper error:', err)
    helperProcess = null
  })
}

function stopHelper(): void {
  if (helperProcess) {
    helperProcess.kill()
    helperProcess = null
  }
  stdoutBuf = ''
}

export function startMeetingDetection(
  getMainWindow: () => BrowserWindow | null,
  ensureMainWindow?: () => BrowserWindow | null,
): void {
  if (process.platform !== 'darwin') return
  getWindow = getMainWindow
  ensureWindow = ensureMainWindow ?? getMainWindow

  registerDetectionBannerIpc({
    onTakeNotes: (payload) => {
      clearPendingDetectionPayload()
      broadcastTakeNotes(payload)
    },
    onDismiss: () => {
      clearPendingDetectionPayload()
    },
    onOpenApp: () => {
      clearPendingDetectionPayload()
      openClarifiApp()
    },
    onMuteApp: (payload) => {
      clearPendingDetectionPayload()
      muteDetectionForApp(payload)
    },
    onOpenSettings: () => {
      clearPendingDetectionPayload()
      openClarifiSettings()
    },
  })

  const enabled = loadAudioPreferences().meetingDetectionEnabled
  syncMeetingDetectionLoginItem(enabled)
  if (!enabled) {
    stopHelper()
    closeDetectionBanner()
    return
  }

  startHelper()
  if (tickTimer) return
  void tick()
  tickTimer = setInterval(() => {
    void tick()
  }, 1000)
}

/** Call when the user toggles meeting detection in Settings. */
export function setMeetingDetectionEnabled(enabled: boolean): void {
  syncMeetingDetectionLoginItem(enabled)
  if (!enabled) {
    if (tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
    stopHelper()
    closeDetectionBanner()
    return
  }
  if (process.platform !== 'darwin') return
  startHelper()
  if (!tickTimer) {
    void tick()
    tickTimer = setInterval(() => {
      void tick()
    }, 1000)
  }
}

export function stopMeetingDetection(): void {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
  stopHelper()
  closeDetectionBanner()
  micActiveSinceMs = null
  lastIdleAtMs = null
  promptedThisSession = false
  latestSnapshot = { inUse: false, pids: [], bundleIds: [] }
}

/** Test helpers */
export function _resetMeetingDetectionForTests(): void {
  stopMeetingDetection()
}

export function _injectSnapshotForTests(snapshot: MicMonitorSnapshot): void {
  latestSnapshot = sanitizeSnapshot(snapshot)
}
