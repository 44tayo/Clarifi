import { app, BrowserWindow } from 'electron'
import * as path from 'path'

let settingsWindow: BrowserWindow | null = null

const isDev = !app.isPackaged

export type SettingsTab =
  | 'profile'
  | 'models'
  | 'modes'
  | 'integrations'
  | 'keybinds'
  | 'audio'
  | 'audio_sessions'
  | 'history'

export const SETTINGS_TABS: readonly SettingsTab[] = [
  'profile',
  'models',
  'modes',
  'integrations',
  'keybinds',
  'audio',
  'audio_sessions',
  'history',
] as const

export function isSettingsTab(value: unknown): value is SettingsTab {
  if (value === 'general') return true
  return typeof value === 'string' && (SETTINGS_TABS as readonly string[]).includes(value)
}

export function normalizeSettingsTab(value: unknown): SettingsTab {
  if (value === 'general' || value === 'models') return 'models'
  if (isSettingsTab(value) && value !== 'general') return value
  return 'profile'
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow
}

export function openSettingsWindow(tab: SettingsTab = 'profile'): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    settingsWindow.webContents.send('settings:tab', tab)
    return settingsWindow
  }

  settingsWindow = new BrowserWindow({
    width: 980,
    height: 640,
    minWidth: 820,
    minHeight: 560,
    center: true,
    resizable: true,
    show: false,
    acceptFirstMouse: true,
    title: 'Clarifi Settings',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: '#0f0f10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show()
    settingsWindow?.webContents.send('settings:tab', tab)
  })

  if (isDev) {
    void settingsWindow.loadURL(`http://localhost:5173/settings.html?tab=${tab}`)
  } else {
    void settingsWindow.loadFile(path.join(__dirname, '../dist/settings.html'), {
      query: { tab },
    })
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })

  return settingsWindow
}
