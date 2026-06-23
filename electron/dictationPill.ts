import { app, BrowserWindow, screen } from 'electron'
import * as path from 'path'

import { getIsRecording } from './audio'
import { getDictationEnabled } from './audioPreferences'
import {
  captureDictationTarget,
  getFollowDisplayId,
  type DictationTargetSnapshot,
} from './dictationInsert'

const PILL_WIDTH = 320
const PILL_HEIGHT = 96
const BOTTOM_MARGIN = 18

let pillWindow: BrowserWindow | null = null
let pillReady = false
let dictationBlocked = false
let dictationBlockedReason = ''
let displayListenerAttached = false
let lastFollowedDisplayId: number | null = null
let lockedDisplayId: number | null = null
let pillFollowPollTimer: ReturnType<typeof setInterval> | null = null
const PILL_FOLLOW_POLL_MS = 250
let pendingSessionStart: DictationTargetSnapshot | null | undefined = undefined

function attachDisplayListener(): void {
  if (displayListenerAttached) return
  displayListenerAttached = true
  const onDisplayChange = () => {
    repositionDictationPillOnDisplayChange()
    followPillToActiveDisplay()
  }
  screen.on('display-metrics-changed', onDisplayChange)
  screen.on('display-added', onDisplayChange)
  screen.on('display-removed', onDisplayChange)
}

function resolveFollowDisplayId(): number {
  if (lockedDisplayId !== null) return lockedDisplayId
  return getFollowDisplayId()
}

function positionPillWindow(window: BrowserWindow, displayId?: number): void {
  const targetId = displayId ?? resolveFollowDisplayId()
  const display =
    screen.getAllDisplays().find((d) => d.id === targetId) ??
    screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { workArea } = display
  const x = Math.round(workArea.x + (workArea.width - PILL_WIDTH) / 2)
  const y = Math.round(workArea.y + workArea.height - PILL_HEIGHT - BOTTOM_MARGIN)
  window.setBounds({ x, y, width: PILL_WIDTH, height: PILL_HEIGHT })
}

function followPillToActiveDisplay(): void {
  if (!pillWindow || pillWindow.isDestroyed() || !pillWindow.isVisible()) return

  const targetDisplayId = resolveFollowDisplayId()
  if (targetDisplayId === lastFollowedDisplayId) return
  positionPillWindow(pillWindow, targetDisplayId)
  lastFollowedDisplayId = targetDisplayId
}

function startPillDisplayFollowPoll(): void {
  if (pillFollowPollTimer) return
  followPillToActiveDisplay()
  pillFollowPollTimer = setInterval(() => {
    if (lockedDisplayId !== null) return
    followPillToActiveDisplay()
  }, PILL_FOLLOW_POLL_MS)
}

function startPillDisplayFollow(): void {
  startPillDisplayFollowPoll()
}

function stopPillDisplayFollow(): void {
  if (pillFollowPollTimer) {
    clearInterval(pillFollowPollTimer)
    pillFollowPollTimer = null
  }
  lastFollowedDisplayId = null
}

function pillUrl(): string {
  if (!app.isPackaged) {
    const devUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173'
    return `${devUrl}/dictation-pill.html`
  }
  return `file://${path.join(__dirname, '../dist/dictation-pill.html')}`
}

function applyPillMousePolicy(window: BrowserWindow, interactive: boolean): void {
  if (window.isDestroyed()) return
  window.setIgnoreMouseEvents(!interactive, { forward: true })
}

function broadcastToPill(channel: string, payload?: unknown): void {
  if (!pillWindow || pillWindow.isDestroyed() || !pillReady) return
  pillWindow.webContents.send(channel, payload)
}

function flushPendingSessionStart(): void {
  if (pendingSessionStart === undefined) return
  const snapshot = pendingSessionStart
  pendingSessionStart = undefined
  broadcastToPill('dictation:session-start', snapshot)
}

export function lockPillToDisplay(displayId: number): void {
  lockedDisplayId = displayId
  if (pillWindow && !pillWindow.isDestroyed()) {
    positionPillWindow(pillWindow, displayId)
  }
}

export function unlockPillDisplay(): void {
  lockedDisplayId = null
  if (pillWindow && !pillWindow.isDestroyed()) {
    followPillToActiveDisplay()
  }
}

export function setDictationBlocked(blocked: boolean, reason = ''): void {
  dictationBlocked = blocked
  dictationBlockedReason = reason
  broadcastToPill('dictation:blocked-changed', { blocked, reason })
}

export function refreshDictationBlockedFromAudioSession(): void {
  if (getIsRecording()) {
    setDictationBlocked(true, 'Stop the live session to use dictation')
  } else {
    setDictationBlocked(false)
  }
}

export function sendDictationSessionStart(snapshot?: DictationTargetSnapshot | null): void {
  if (!getDictationEnabled()) return

  if (dictationBlocked) {
    broadcastToPill('dictation:blocked-changed', {
      blocked: true,
      reason: dictationBlockedReason,
    })
    return
  }

  const target = snapshot ?? captureDictationTarget()
  if (target) {
    lockPillToDisplay(target.displayId)
  }

  if (!pillReady) {
    pendingSessionStart = target
    return
  }

  broadcastToPill('dictation:session-start', target)
  if (pillWindow && !pillWindow.isDestroyed()) {
    pillWindow.showInactive()
    startPillDisplayFollow()
  }
}

export function sendDictationSessionFinish(): void {
  unlockPillDisplay()
  broadcastToPill('dictation:session-finish')
  if (getDictationEnabled()) {
    if (pillWindow && !pillWindow.isDestroyed()) {
      pillWindow.showInactive()
      startPillDisplayFollow()
    }
    return
  }
  hideDictationPillWindow()
}

export function sendDictationSessionCancel(): void {
  unlockPillDisplay()
  broadcastToPill('dictation:session-cancel')
  if (getDictationEnabled()) {
    if (pillWindow && !pillWindow.isDestroyed()) {
      pillWindow.showInactive()
      startPillDisplayFollow()
    }
    return
  }
  hideDictationPillWindow()
}

export function getDictationPillWindow(): BrowserWindow | null {
  return pillWindow
}

export function createDictationPillWindow(): BrowserWindow {
  if (pillWindow && !pillWindow.isDestroyed()) {
    return pillWindow
  }

  pillReady = false
  pendingSessionStart = undefined
  attachDisplayListener()

  pillWindow = new BrowserWindow({
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
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

  positionPillWindow(pillWindow)
  applyPillMousePolicy(pillWindow, false)

  if (process.platform === 'darwin') {
    pillWindow.setAlwaysOnTop(true, 'floating', 1)
    pillWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } else {
    pillWindow.setAlwaysOnTop(true, 'screen-saver')
    pillWindow.setVisibleOnAllWorkspaces(true)
  }

  pillWindow.on('closed', () => {
    stopPillDisplayFollow()
    pillWindow = null
    pillReady = false
    lockedDisplayId = null
    pendingSessionStart = undefined
  })

  void pillWindow.loadURL(pillUrl())
  pillWindow.once('ready-to-show', () => {
    if (!pillWindow || pillWindow.isDestroyed()) return
    positionPillWindow(pillWindow)
    lastFollowedDisplayId = resolveFollowDisplayId()
  })

  return pillWindow
}

export function destroyDictationPillWindow(): void {
  stopPillDisplayFollow()
  if (pillWindow && !pillWindow.isDestroyed()) {
    pillWindow.destroy()
  }
  pillWindow = null
  pillReady = false
  lockedDisplayId = null
  pendingSessionStart = undefined
}

export function showDictationPillWindow(): void {
  if (!pillWindow || pillWindow.isDestroyed()) {
    createDictationPillWindow()
    return
  }
  positionPillWindow(pillWindow)
  lastFollowedDisplayId = resolveFollowDisplayId()
  pillWindow.showInactive()
  startPillDisplayFollow()
}

export function hideDictationPillWindow(): void {
  stopPillDisplayFollow()
  if (pillWindow && !pillWindow.isDestroyed()) {
    pillWindow.hide()
  }
}

export function markDictationPillReady(): void {
  pillReady = true
  refreshDictationBlockedFromAudioSession()
  broadcastToPill('dictation:blocked-changed', {
    blocked: dictationBlocked,
    reason: dictationBlockedReason,
  })
  flushPendingSessionStart()
  if (getDictationEnabled()) {
    showDictationPillWindow()
  }
}

export function setDictationPillInteractive(interactive: boolean): void {
  if (!pillWindow || pillWindow.isDestroyed()) return
  applyPillMousePolicy(pillWindow, interactive)
}

export function repositionDictationPillOnDisplayChange(): void {
  if (!pillWindow || pillWindow.isDestroyed()) return
  positionPillWindow(pillWindow)
}

export { captureDictationTarget, type DictationTargetSnapshot }
