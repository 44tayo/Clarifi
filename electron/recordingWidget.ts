import * as path from 'path'
import { app, BrowserWindow, nativeTheme, screen } from 'electron'

import type { WidgetMode, WidgetPanel } from './widgetBounds'
import {
  WIDGET_EXPANDED_MAX,
  WIDGET_EXPANDED_MIN,
  WIDGET_SIZES,
} from './widgetBounds'
import { loadAudioPreferences } from './audioPreferences'
import { resolveAppTheme } from './theme'

const isDev = !app.isPackaged

let widgetWindow: BrowserWindow | null = null
let recordingStartedAt: number | null = null
let widgetMode: WidgetMode = 'compact'
let widgetPanel: WidgetPanel = 'notepad'
let activeMeetingId: string | null = null
let activityState = 'silent'
let isPaused = false
/** Remember last expanded size so reopen/expand keeps user resize. */
let lastExpandedSize = { ...WIDGET_SIZES.expanded }

function currentTheme(): 'light' | 'dark' {
  return resolveAppTheme(loadAudioPreferences().theme)
}

function backgroundColorFor(mode: WidgetMode): string {
  if (mode === 'compact') return '#00000000'
  return currentTheme() === 'dark' ? '#1a1a1c' : '#ffffff'
}

export function isWidgetOpen(): boolean {
  return Boolean(widgetWindow && !widgetWindow.isDestroyed())
}

export function getRecordingStartedAt(): number | null {
  return recordingStartedAt
}

export function getWidgetMode(): WidgetMode {
  return widgetMode
}

export function setActiveMeetingForWidget(meetingId: string | null): void {
  activeMeetingId = meetingId
  broadcastWidgetState()
}

export function setWidgetActivity(state: string): void {
  activityState = state
  broadcastWidgetState()
}

function defaultAnchor(): { x: number; y: number; width: number; height: number } {
  const display = screen.getPrimaryDisplay()
  const size = WIDGET_SIZES[widgetMode]
  const x = Math.round(display.workArea.x + display.workAreaSize.width - size.width - 24)
  const y = display.workArea.y + 24
  return { x, y, width: size.width, height: size.height }
}

function rememberExpandedSize(): void {
  if (!widgetWindow || widgetWindow.isDestroyed()) return
  if (widgetMode !== 'expanded') return
  const { width, height } = widgetWindow.getBounds()
  lastExpandedSize = {
    width: Math.min(WIDGET_EXPANDED_MAX.width, Math.max(WIDGET_EXPANDED_MIN.width, width)),
    height: Math.min(WIDGET_EXPANDED_MAX.height, Math.max(WIDGET_EXPANDED_MIN.height, height)),
  }
}

function applyModeChrome(mode: WidgetMode): void {
  if (!widgetWindow || widgetWindow.isDestroyed()) return
  widgetWindow.setBackgroundColor(backgroundColorFor(mode))
  widgetWindow.setHasShadow(true)
  if (mode === 'expanded') {
    widgetWindow.setResizable(true)
    widgetWindow.setMinimumSize(WIDGET_EXPANDED_MIN.width, WIDGET_EXPANDED_MIN.height)
    widgetWindow.setMaximumSize(WIDGET_EXPANDED_MAX.width, WIDGET_EXPANDED_MAX.height)
  } else {
    widgetWindow.setResizable(false)
    widgetWindow.setMinimumSize(WIDGET_SIZES.compact.width, WIDGET_SIZES.compact.height)
    widgetWindow.setMaximumSize(WIDGET_SIZES.compact.width, WIDGET_SIZES.compact.height)
  }
}

function applyWidgetBounds(mode: WidgetMode): void {
  if (!widgetWindow || widgetWindow.isDestroyed()) return
  const size = mode === 'expanded' ? lastExpandedSize : WIDGET_SIZES[mode]
  const current = widgetWindow.getBounds()
  const x = current.x + current.width - size.width
  const y = current.y
  widgetWindow.setBounds({ x, y, width: size.width, height: size.height }, true)
}

export function setWidgetMode(mode: WidgetMode): void {
  if (widgetMode === 'expanded' && mode !== 'expanded') {
    rememberExpandedSize()
  }
  widgetMode = mode
  applyModeChrome(mode)
  applyWidgetBounds(mode)
  broadcastWidgetState()
}

export function setWidgetPanel(panel: WidgetPanel): void {
  widgetPanel = panel
  broadcastWidgetState()
}

export function setRecordingStartedAt(at: number | null): void {
  recordingStartedAt = at
  broadcastWidgetState()
}

export function setWidgetPaused(paused: boolean): void {
  isPaused = paused
  broadcastWidgetState()
}

function broadcastPayload() {
  return {
    recording: recordingStartedAt != null,
    startedAt: recordingStartedAt,
    mode: widgetMode,
    panel: widgetPanel,
    theme: currentTheme(),
    meetingId: activeMeetingId,
    activity: activityState,
    paused: isPaused,
  }
}

nativeTheme.on('updated', () => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.setBackgroundColor(backgroundColorFor(widgetMode))
  }
  broadcastWidgetState()
})

export function broadcastWidgetState(): void {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('widget:state', broadcastPayload())
  }
}

export function broadcastTranscriptToWidget(payload: {
  recent: unknown[]
  full: unknown[]
}): void {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('transcript:update', payload)
  }
}

export function broadcastTranscriptInterimToWidget(payload: {
  source: 'mic' | 'system'
  update: { text: string; speaker: string } | null
}): void {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('transcript:interim', payload)
  }
}

export function createOrShowWidget(): BrowserWindow {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.show()
    widgetWindow.focus()
    // Only snap size when compact; don't clobber an expanded user resize on re-show.
    if (widgetMode === 'compact') {
      applyWidgetBounds(widgetMode)
    }
    broadcastWidgetState()
    return widgetWindow
  }

  widgetMode = 'compact'
  lastExpandedSize = { ...WIDGET_SIZES.expanded }
  const anchor = defaultAnchor()

  widgetWindow = new BrowserWindow({
    width: anchor.width,
    height: anchor.height,
    x: anchor.x,
    y: anchor.y,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    focusable: true,
    title: 'Clarifi Recording',
    backgroundColor: backgroundColorFor(widgetMode),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  applyModeChrome(widgetMode)
  widgetWindow.setAlwaysOnTop(true, 'floating')
  widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  widgetWindow.show()
  widgetWindow.focus()

  widgetWindow.on('resized', () => {
    rememberExpandedSize()
  })

  if (isDev) {
    void widgetWindow.loadURL('http://localhost:5173/widget.html')
  } else {
    void widgetWindow.loadFile(path.join(__dirname, '../dist/widget.html'))
  }

  widgetWindow.on('closed', () => {
    widgetWindow = null
  })

  widgetWindow.webContents.on('did-finish-load', () => {
    broadcastWidgetState()
  })

  return widgetWindow
}

export function hideWidget(): void {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.hide()
  }
}

export function closeWidget(): void {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    rememberExpandedSize()
    widgetWindow.close()
  }
  widgetWindow = null
  widgetMode = 'compact'
  widgetPanel = 'notepad'
  activeMeetingId = null
  activityState = 'silent'
  isPaused = false
}
