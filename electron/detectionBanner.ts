import * as path from 'path'
import { app, BrowserWindow, ipcMain, screen } from 'electron'

import type { CalendarEvent } from '../shared/calendar'
import type { DetectedMeetingPayload } from '../shared/meetingDetection'

function isDevMode(): boolean {
  return !app?.isPackaged
}

type PendingDetection = {
  kind: 'detection'
  payload: DetectedMeetingPayload
}

type PendingCalendar = {
  kind: 'calendar'
  event: CalendarEvent
}

type PendingPrompt = PendingDetection | PendingCalendar

export const DETECTION_BANNER_WIDTH = 360
export const DETECTION_BANNER_HEIGHT = 76
export const DETECTION_BANNER_MENU_HEIGHT = 200

let bannerWindow: BrowserWindow | null = null
let pendingPrompt: PendingPrompt | null = null
let handlersRegistered = false

const handlers: {
  onTakeNotes: ((payload: DetectedMeetingPayload) => void) | null
  onCalendarStart: ((event: CalendarEvent) => void) | null
  onOpenApp: (() => void) | null
  onMuteApp: ((payload: DetectedMeetingPayload) => void) | null
  onOpenSettings: (() => void) | null
  onDismiss: (() => void) | null
} = {
  onTakeNotes: null,
  onCalendarStart: null,
  onOpenApp: null,
  onMuteApp: null,
  onOpenSettings: null,
  onDismiss: null,
}

function bannerPreloadPath(): string {
  return path.join(__dirname, 'detection-banner-preload.js')
}

function bannerOrigin(): { x: number; y: number } {
  const display = screen.getPrimaryDisplay()
  const marginRight = 24
  return {
    x: Math.round(display.workArea.x + display.workAreaSize.width - DETECTION_BANNER_WIDTH - marginRight),
    y: display.workArea.y + 16,
  }
}

export function getPendingDetectionPayload(): DetectedMeetingPayload | null {
  return pendingPrompt?.kind === 'detection' ? pendingPrompt.payload : null
}

export function clearPendingDetectionPayload(): void {
  if (pendingPrompt?.kind === 'detection') pendingPrompt = null
}

export function closeDetectionBanner(): void {
  if (bannerWindow && !bannerWindow.isDestroyed()) {
    bannerWindow.close()
  }
  bannerWindow = null
}

function setBannerMenuOpen(open: boolean): void {
  if (!bannerWindow || bannerWindow.isDestroyed()) return
  const { x, y } = bannerOrigin()
  const height = open ? DETECTION_BANNER_MENU_HEIGHT : DETECTION_BANNER_HEIGHT
  bannerWindow.setBounds({ x, y, width: DETECTION_BANNER_WIDTH, height }, false)
}

function openBannerWindow(params: URLSearchParams): void {
  closeDetectionBanner()

  const { x, y } = bannerOrigin()

  bannerWindow = new BrowserWindow({
    width: DETECTION_BANNER_WIDTH,
    height: DETECTION_BANNER_HEIGHT,
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

  if (isDevMode()) {
    void bannerWindow.loadURL(`http://localhost:5173/detection-banner.html?${params}`)
  } else {
    void bannerWindow.loadFile(path.join(__dirname, '../dist/detection-banner.html'), {
      query: Object.fromEntries(params.entries()),
    })
  }

  bannerWindow.once('ready-to-show', () => {
    if (bannerWindow && !bannerWindow.isDestroyed()) bannerWindow.showInactive()
  })

  bannerWindow.on('closed', () => {
    bannerWindow = null
  })
}

export function showDetectionBanner(payload: DetectedMeetingPayload): void {
  pendingPrompt = { kind: 'detection', payload }
  openBannerWindow(
    new URLSearchParams({
      kind: 'detection',
      title: 'Are you in a meeting?',
      subtitle: 'Start Clarifi to take notes',
      appName: payload.appName || 'this app',
      bundleId: payload.bundleId || '',
    }),
  )
}

export function showCalendarReminderBanner(event: CalendarEvent): void {
  pendingPrompt = { kind: 'calendar', event }
  openBannerWindow(
    new URLSearchParams({
      kind: 'calendar',
      title: 'Meeting starting soon',
      subtitle: event.title?.trim() || 'Untitled meeting',
      appName: '',
      bundleId: '',
    }),
  )
}

export function registerDetectionBannerIpc(next: {
  onTakeNotes?: (payload: DetectedMeetingPayload) => void
  onCalendarStart?: (event: CalendarEvent) => void
  onOpenApp?: () => void
  onMuteApp?: (payload: DetectedMeetingPayload) => void
  onOpenSettings?: () => void
  onDismiss?: () => void
}): void {
  if (next.onTakeNotes) handlers.onTakeNotes = next.onTakeNotes
  if (next.onCalendarStart) handlers.onCalendarStart = next.onCalendarStart
  if (next.onOpenApp) handlers.onOpenApp = next.onOpenApp
  if (next.onMuteApp) handlers.onMuteApp = next.onMuteApp
  if (next.onOpenSettings) handlers.onOpenSettings = next.onOpenSettings
  if (next.onDismiss) handlers.onDismiss = next.onDismiss

  if (handlersRegistered) return
  handlersRegistered = true

  ipcMain.handle('meeting:detection-take-notes', () => {
    const pending = pendingPrompt
    pendingPrompt = null
    closeDetectionBanner()
    if (pending?.kind === 'detection') {
      handlers.onTakeNotes?.(pending.payload)
    } else if (pending?.kind === 'calendar') {
      handlers.onCalendarStart?.(pending.event)
    }
    return { ok: true }
  })

  ipcMain.handle('meeting:detection-dismiss', () => {
    pendingPrompt = null
    closeDetectionBanner()
    handlers.onDismiss?.()
    return { ok: true }
  })

  ipcMain.handle('meeting:detection-open-app', () => {
    pendingPrompt = null
    closeDetectionBanner()
    handlers.onOpenApp?.()
    return { ok: true }
  })

  ipcMain.handle('meeting:detection-mute-app', () => {
    const pending = pendingPrompt
    pendingPrompt = null
    closeDetectionBanner()
    if (pending?.kind === 'detection') {
      handlers.onMuteApp?.(pending.payload)
    }
    return { ok: true }
  })

  ipcMain.handle('meeting:detection-open-settings', () => {
    pendingPrompt = null
    closeDetectionBanner()
    handlers.onOpenSettings?.()
    return { ok: true }
  })

  ipcMain.handle('meeting:detection-menu-open', (_event, open: unknown) => {
    setBannerMenuOpen(Boolean(open))
    return { ok: true }
  })
}
