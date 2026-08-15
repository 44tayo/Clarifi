import * as fs from 'fs'
import * as path from 'path'

import {
  app,
  Menu,
  Tray,
  nativeImage,
  type BrowserWindow,
  type MenuItemConstructorOptions,
  type NativeImage,
} from 'electron'

import { listMeetings } from './meetingStore'
import { getPermissionStatus } from './permissions'
import { checkForSignedUpdates } from './updater'

export type TrayRecordingState = 'idle' | 'recording' | 'paused' | 'error'

type WindowGetter = () => BrowserWindow | null
type EnsureWindow = () => BrowserWindow

export type AppTrayController = {
  setRecordingState: (state: TrayRecordingState) => void
  refreshMenu: () => void
  destroy: () => void
}

let tray: Tray | null = null
let recordingState: TrayRecordingState = 'idle'
let getWindow: WindowGetter = () => null
let ensureWindow: EnsureWindow = () => {
  throw new Error('ensureWindow not configured')
}

void getWindow

function trayDir(): string {
  const candidates = [
    path.join(app.getAppPath(), 'build', 'tray'),
    path.join(__dirname, '..', 'build', 'tray'),
    path.join(process.cwd(), 'build', 'tray'),
  ]
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'trayIdleTemplate.png'))) return dir
  }
  return candidates[0]
}

function iconFileForState(state: TrayRecordingState): string {
  switch (state) {
    case 'recording':
      return 'trayRecordingTemplate.png'
    case 'paused':
      return 'trayPausedTemplate.png'
    case 'error':
      return 'trayErrorTemplate.png'
    case 'idle':
    default:
      return 'trayIdleTemplate.png'
  }
}

function loadTrayImage(state: TrayRecordingState): NativeImage {
  const file = iconFileForState(state)
  const base = path.join(trayDir(), file)
  const img = nativeImage.createFromPath(base)
  if (img.isEmpty()) {
    console.warn('Tray icon missing or empty:', base)
    return nativeImage.createEmpty()
  }
  if (process.platform === 'darwin') {
    img.setTemplateImage(true)
  }
  return img
}

function showMainWindow(): BrowserWindow {
  const win = ensureWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  return win
}

function sendToMain(channel: string, payload?: unknown): void {
  const win = showMainWindow()
  if (!win.isDestroyed()) {
    win.webContents.send(channel, payload)
  }
}

function permissionsNeedAttention(): boolean {
  if (process.platform !== 'darwin') return false
  const status = getPermissionStatus()
  return status.microphone === 'denied' || status.systemAudio === 'denied'
}

function buildMenu(): Menu {
  const version = app.getVersion()
  const isRecording = recordingState === 'recording' || recordingState === 'paused'
  const permsBad = permissionsNeedAttention()

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Open Clarifi',
      click: () => {
        showMainWindow()
      },
    },
    {
      label: 'New note',
      click: () => {
        sendToMain('tray:new-note')
      },
    },
    {
      label: 'Start recording',
      enabled: !isRecording,
      click: () => {
        sendToMain('tray:start-recording')
      },
    },
    {
      label: 'Open last meeting',
      click: () => {
        const meetings = listMeetings()
        const last = meetings[0]
        if (last) {
          sendToMain('tray:open-meeting', { meetingId: last.id })
        } else {
          showMainWindow()
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Settings…',
      click: () => {
        sendToMain('tray:open-settings')
      },
    },
    {
      label: permsBad ? 'Permissions… ⚠' : 'Permissions…',
      click: () => {
        sendToMain('tray:open-permissions')
      },
    },
    { type: 'separator' },
    {
      label: `Clarifi v${version}`,
      enabled: false,
    },
    {
      label: 'Check for updates…',
      click: () => {
        const win = showMainWindow()
        if (!win.isDestroyed()) {
          win.webContents.send('update:menu-check')
        }
        void checkForSignedUpdates()
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Clarifi',
      click: () => {
        app.quit()
      },
    },
  ]

  return Menu.buildFromTemplate(template)
}

function applyIconAndTooltip(): void {
  if (!tray) return
  tray.setImage(loadTrayImage(recordingState))
  const tip =
    recordingState === 'recording'
      ? 'Clarifi — Recording'
      : recordingState === 'paused'
        ? 'Clarifi — Paused'
        : recordingState === 'error'
          ? 'Clarifi — Permissions needed'
          : 'Clarifi'
  tray.setToolTip(tip)
}

function applyMenu(): void {
  if (!tray) return
  tray.setContextMenu(buildMenu())
}

/**
 * Create the macOS (and Windows) menu bar status item for Clarifi.
 * Same app process — not a separate utility.
 */
export function createAppTray(options: {
  getWindow: WindowGetter
  ensureWindow: EnsureWindow
}): AppTrayController {
  getWindow = options.getWindow
  ensureWindow = options.ensureWindow

  if (tray) {
    applyIconAndTooltip()
    applyMenu()
    return {
      setRecordingState: setTrayRecordingState,
      refreshMenu: applyMenu,
      destroy: destroyAppTray,
    }
  }

  const image = loadTrayImage('idle')
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)
  tray.setIgnoreDoubleClickEvents(true)
  applyIconAndTooltip()
  applyMenu()

  tray.on('click', () => {
    if (process.platform !== 'darwin' && tray) {
      tray.popUpContextMenu()
    }
  })

  return {
    setRecordingState: setTrayRecordingState,
    refreshMenu: applyMenu,
    destroy: destroyAppTray,
  }
}

export function setTrayRecordingState(state: TrayRecordingState): void {
  recordingState = state
  applyIconAndTooltip()
  applyMenu()
}

export function refreshAppTrayMenu(): void {
  applyMenu()
}

export function destroyAppTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}

/** Sync tray icon from permission status when idle (no active session). */
export function syncTrayPermissionState(): void {
  if (recordingState === 'recording' || recordingState === 'paused') return
  setTrayRecordingState(permissionsNeedAttention() ? 'error' : 'idle')
}
