import * as path from 'path'
import { app, BrowserWindow, ipcMain, screen } from 'electron'

import type { DetectedMeetingPayload } from '../shared/meetingDetection'

const isDev = !app.isPackaged

let bannerWindow: BrowserWindow | null = null
let pendingPayload: DetectedMeetingPayload | null = null
let handlersRegistered = false

function bannerPreloadPath(): string {
  return path.join(__dirname, 'detection-banner-preload.js')
}

export function getPendingDetectionPayload(): DetectedMeetingPayload | null {
  return pendingPayload
}

export function clearPendingDetectionPayload(): void {
  pendingPayload = null
}

export function closeDetectionBanner(): void {
  if (bannerWindow && !bannerWindow.isDestroyed()) {
    bannerWindow.close()
  }
  bannerWindow = null
}

export function showDetectionBanner(payload: DetectedMeetingPayload): void {
  pendingPayload = payload
  closeDetectionBanner()

  const display = screen.getPrimaryDisplay()
  const width = 440
  const height = 88
  const x = Math.round(display.workArea.x + (display.workAreaSize.width - width) / 2)
  const y = display.workArea.y + 16

  bannerWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    hasShadow: true,
    show: false,
    focusable: true,
    webPreferences: {
      preload: bannerPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  bannerWindow.setAlwaysOnTop(true, 'floating')
  bannerWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const params = new URLSearchParams({
    title: payload.title,
    appName: payload.appName,
    suggestedTitle: payload.suggestedTitle,
  })

  if (isDev) {
    void bannerWindow.loadURL(`http://localhost:5173/detection-banner.html?${params}`)
  } else {
    void bannerWindow.loadFile(path.join(__dirname, '../dist/detection-banner.html'), {
      query: {
        title: payload.title,
        appName: payload.appName,
        suggestedTitle: payload.suggestedTitle,
      },
    })
  }

  bannerWindow.once('ready-to-show', () => {
    if (bannerWindow && !bannerWindow.isDestroyed()) bannerWindow.showInactive()
  })

  bannerWindow.on('closed', () => {
    bannerWindow = null
  })
}

export function registerDetectionBannerIpc(handlers: {
  onTakeNotes: (payload: DetectedMeetingPayload) => void
  onDismiss: () => void
}): void {
  if (handlersRegistered) return
  handlersRegistered = true

  ipcMain.handle('meeting:detection-take-notes', () => {
    const payload = pendingPayload
    closeDetectionBanner()
    if (payload) handlers.onTakeNotes(payload)
    return { ok: true }
  })

  ipcMain.handle('meeting:detection-dismiss', () => {
    closeDetectionBanner()
    clearPendingDetectionPayload()
    handlers.onDismiss()
    return { ok: true }
  })
}
