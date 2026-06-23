import { app, BrowserWindow, screen } from 'electron'
import * as path from 'path'

import { getIsRecording } from './audio'
import { getFrontmostAppNameCached } from './proactive/textExtraction'
import { applyMacCaptureExclusion } from './windowCaptureExclude'
import { getOverlayWindow } from './overlay'

const PROMPT_WIDTH = 340
const PROMPT_HEIGHT = 72
const POLL_MS = 2000
const SNOOZE_MS = 30 * 60 * 1000

const MEETING_APP_PATTERNS = [
  /^zoom\.us$/i,
  /^zoom$/i,
  /^microsoft teams$/i,
  /^teams$/i,
  /^webex$/i,
  /^slack$/i,
  /^facetime$/i,
  /^google chrome$/i,
  /^chromium$/i,
  /^arc$/i,
  /^brave browser$/i,
  /^microsoft edge$/i,
]

let monitorTimer: ReturnType<typeof setInterval> | null = null
let promptWindow: BrowserWindow | null = null
let snoozedUntil = 0
let lastPromptedApp: string | null = null
let currentMeetingApp: string | null = null

function promptUrl(): string {
  if (!app.isPackaged) {
    const devUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173'
    return `${devUrl}/meeting-prompt.html`
  }
  return `file://${path.join(__dirname, '../dist/meeting-prompt.html')}`
}

function isMeetingApp(appName: string | null): boolean {
  if (!appName) return false
  return MEETING_APP_PATTERNS.some((pattern) => pattern.test(appName.trim()))
}

function positionPromptWindow(window: BrowserWindow): void {
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { workArea } = display
  const x = Math.round(workArea.x + workArea.width - PROMPT_WIDTH - 20)
  const y = Math.round(workArea.y + workArea.height - PROMPT_HEIGHT - 24)
  window.setBounds({ x, y, width: PROMPT_WIDTH, height: PROMPT_HEIGHT })
}

function applyStealthPolicies(window: BrowserWindow): void {
  if (process.platform === 'darwin') {
    window.setAlwaysOnTop(true, 'floating', 1)
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    const handle = window.getNativeWindowHandle()
    if (handle) {
      applyMacCaptureExclusion(handle, true)
    }
  } else {
    window.setAlwaysOnTop(true, 'screen-saver')
    window.setVisibleOnAllWorkspaces(true)
  }
}

function hideMeetingPrompt(): void {
  if (promptWindow && !promptWindow.isDestroyed()) {
    promptWindow.hide()
  }
}

function destroyMeetingPrompt(): void {
  if (promptWindow && !promptWindow.isDestroyed()) {
    promptWindow.destroy()
  }
  promptWindow = null
}

function ensureMeetingPromptWindow(): BrowserWindow {
  if (promptWindow && !promptWindow.isDestroyed()) {
    return promptWindow
  }

  promptWindow = new BrowserWindow({
    width: PROMPT_WIDTH,
    height: PROMPT_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    focusable: false,
    acceptFirstMouse: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  positionPromptWindow(promptWindow)
  applyStealthPolicies(promptWindow)
  void promptWindow.loadURL(promptUrl())

  promptWindow.on('closed', () => {
    promptWindow = null
  })

  return promptWindow
}

function showMeetingPrompt(appName: string): void {
  const window = ensureMeetingPromptWindow()
  positionPromptWindow(window)
  window.webContents.send('meeting-prompt:show', { appName })
  window.showInactive()
  lastPromptedApp = appName
}

function pollMeetingApps(): void {
  if (Date.now() < snoozedUntil) {
    hideMeetingPrompt()
    return
  }

  if (getIsRecording()) {
    hideMeetingPrompt()
    return
  }

  const frontApp = getFrontmostAppNameCached(false)
  if (!isMeetingApp(frontApp)) {
    currentMeetingApp = null
    hideMeetingPrompt()
    return
  }

  currentMeetingApp = frontApp
  if (lastPromptedApp === frontApp && promptWindow?.isVisible()) {
    return
  }

  showMeetingPrompt(frontApp ?? 'Meeting')
}

export function startMeetingPromptMonitor(): void {
  if (monitorTimer) return
  pollMeetingApps()
  monitorTimer = setInterval(pollMeetingApps, POLL_MS)
}

export function stopMeetingPromptMonitor(): void {
  if (monitorTimer) {
    clearInterval(monitorTimer)
    monitorTimer = null
  }
  destroyMeetingPrompt()
  currentMeetingApp = null
  lastPromptedApp = null
}

export function dismissMeetingPrompt(snooze = true): void {
  if (snooze) {
    snoozedUntil = Date.now() + SNOOZE_MS
  }
  lastPromptedApp = currentMeetingApp
  hideMeetingPrompt()
}

export function startRecordingFromMeetingPrompt(): void {
  const overlay = getOverlayWindow()
  if (overlay && !overlay.isDestroyed()) {
    if (!overlay.isVisible()) {
      overlay.showInactive()
    }
    overlay.webContents.send('keybind:action', { action: 'toggle_recording' })
  }
  hideMeetingPrompt()
  lastPromptedApp = currentMeetingApp
}
