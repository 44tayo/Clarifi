import * as path from 'path'

import { app, BrowserWindow, screen } from 'electron'

const isDev = !app.isPackaged

let widgetWindow: BrowserWindow | null = null
let recordingStartedAt: number | null = null

export function isWidgetOpen(): boolean {
  return Boolean(widgetWindow && !widgetWindow.isDestroyed())
}

export function getRecordingStartedAt(): number | null {
  return recordingStartedAt
}

export function setRecordingStartedAt(at: number | null): void {
  recordingStartedAt = at
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('widget:state', {
      recording: at != null,
      startedAt: at,
    })
  }
}

export function createOrShowWidget(): BrowserWindow {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.showInactive()
    return widgetWindow
  }

  const display = screen.getPrimaryDisplay()
  const { width } = display.workAreaSize
  const winWidth = 220
  const winHeight = 48

  widgetWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: Math.round(width - winWidth - 24),
    y: display.workArea.y + 24,
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
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  widgetWindow.setAlwaysOnTop(true, 'floating')
  widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (isDev) {
    void widgetWindow.loadURL('http://localhost:5173/widget.html')
  } else {
    void widgetWindow.loadFile(path.join(__dirname, '../dist/widget.html'))
  }

  widgetWindow.on('closed', () => {
    widgetWindow = null
  })

  widgetWindow.webContents.on('did-finish-load', () => {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.webContents.send('widget:state', {
        recording: recordingStartedAt != null,
        startedAt: recordingStartedAt,
      })
    }
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
    widgetWindow.close()
  }
  widgetWindow = null
}

export function broadcastWidgetState(): void {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('widget:state', {
      recording: recordingStartedAt != null,
      startedAt: recordingStartedAt,
    })
  }
}
