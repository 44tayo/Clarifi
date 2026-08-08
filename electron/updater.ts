import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'

const ALLOWED_UPDATE_HOSTS = ['github.com', 'api.github.com'] as const
/** Re-check while the app stays open (plan: 4–6 hours). */
const PERIODIC_CHECK_MS = 5 * 60 * 60 * 1000

export type UpdateUiStatus = {
  currentVersion: string
  packaged: boolean
  checking: boolean
  availableVersion: string | null
  releaseNotes: string | null
  downloadPercent: number | null
  downloaded: boolean
  lastCheckedAt: number | null
  error: string | null
}

type WindowGetter = () => BrowserWindow | null

let getMainWindow: WindowGetter = () => null
let periodicTimer: ReturnType<typeof setInterval> | null = null
let handlersRegistered = false
let configured = false

let checking = false
let availableVersion: string | null = null
let releaseNotes: string | null = null
let downloadPercent: number | null = null
let downloaded = false
let lastCheckedAt: number | null = null
let lastError: string | null = null

function releaseNotesText(info: UpdateInfo): string | null {
  const notes = info.releaseNotes
  if (typeof notes === 'string' && notes.trim()) return notes.trim()
  if (Array.isArray(notes)) {
    const joined = notes
      .map((n) => (typeof n === 'string' ? n : n.note))
      .filter((n): n is string => Boolean(n?.trim()))
      .join('\n')
      .trim()
    return joined || null
  }
  return null
}

function snapshot(): UpdateUiStatus {
  return {
    currentVersion: app.getVersion(),
    packaged: app.isPackaged,
    checking,
    availableVersion,
    releaseNotes,
    downloadPercent,
    downloaded,
    lastCheckedAt,
    error: lastError,
  }
}

function broadcast(channel: string, payload: unknown): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload)
  }
  for (const other of BrowserWindow.getAllWindows()) {
    if (other === win || other.isDestroyed()) continue
    other.webContents.send(channel, payload)
  }
}

function emitStatus(): void {
  broadcast('update:status', snapshot())
}

function setError(message: string): void {
  lastError = message
  checking = false
  broadcast('update:error', { message })
  emitStatus()
}

export function getUpdateStatus(): UpdateUiStatus {
  return snapshot()
}

export async function configureUpdater(getWindow: WindowGetter): Promise<void> {
  getMainWindow = getWindow
  registerUpdateIpc()

  if (!app.isPackaged || configured) {
    emitStatus()
    return
  }
  configured = true

  autoUpdater.autoDownload = false
  autoUpdater.allowDowngrade = false

  autoUpdater.on('checking-for-update', () => {
    checking = true
    lastError = null
    emitStatus()
  })

  autoUpdater.on('update-available', (info) => {
    checking = false
    lastCheckedAt = Date.now()
    lastError = null
    availableVersion = info.version
    releaseNotes = releaseNotesText(info)
    downloaded = false
    downloadPercent = null
    broadcast('update:available', {
      version: info.version,
      releaseNotes,
    })
    emitStatus()
  })

  autoUpdater.on('update-not-available', () => {
    checking = false
    lastCheckedAt = Date.now()
    lastError = null
    availableVersion = null
    releaseNotes = null
    downloaded = false
    downloadPercent = null
    broadcast('update:not-available', { version: app.getVersion() })
    emitStatus()
  })

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    downloadPercent = Math.max(0, Math.min(100, progress.percent))
    broadcast('update:progress', { percent: downloadPercent })
    emitStatus()
  })

  autoUpdater.on('update-downloaded', (info) => {
    checking = false
    downloaded = true
    downloadPercent = 100
    availableVersion = info.version
    lastError = null
    broadcast('update:downloaded', { version: info.version })
    emitStatus()
  })

  autoUpdater.on('error', (error) => {
    setError(error?.message || 'Couldn’t check for updates')
  })

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: process.env.GH_UPDATE_OWNER ?? 'Tayowill',
    repo: process.env.GH_UPDATE_REPO ?? 'clarificluely',
  })

  autoUpdater.requestHeaders = {}

  const originalCheckForUpdates = autoUpdater.checkForUpdates.bind(autoUpdater)
  autoUpdater.checkForUpdates = async () => {
    const feedUrl = autoUpdater.getFeedURL()
    if (typeof feedUrl === 'string') {
      const hostname = new URL(feedUrl).hostname
      if (!ALLOWED_UPDATE_HOSTS.includes(hostname as (typeof ALLOWED_UPDATE_HOSTS)[number])) {
        throw new Error(`Blocked update from untrusted host: ${hostname}`)
      }
    }
    return originalCheckForUpdates()
  }

  if (periodicTimer) clearInterval(periodicTimer)
  periodicTimer = setInterval(() => {
    void checkForSignedUpdates()
  }, PERIODIC_CHECK_MS)
  // Allow the process to exit without waiting on the interval.
  periodicTimer.unref?.()
}

export async function checkForSignedUpdates(): Promise<UpdateUiStatus> {
  if (!app.isPackaged) {
    lastCheckedAt = Date.now()
    lastError = null
    checking = false
    emitStatus()
    return snapshot()
  }

  // Unsigned Windows installs cannot verify GitHub release signatures reliably.
  if (process.platform === 'win32' && !process.env.CLARIFI_ALLOW_WIN_UPDATES) {
    lastCheckedAt = Date.now()
    lastError = null
    checking = false
    broadcast('update:not-available', { version: app.getVersion() })
    emitStatus()
    return snapshot()
  }

  try {
    checking = true
    lastError = null
    emitStatus()
    await autoUpdater.checkForUpdates()
  } catch (error) {
    setError(
      error instanceof Error ? error.message : 'Couldn’t check for updates',
    )
  }
  return snapshot()
}

export async function downloadSignedUpdate(): Promise<UpdateUiStatus> {
  if (!app.isPackaged) {
    setError('Updates are only available in the installed app.')
    return snapshot()
  }
  try {
    lastError = null
    downloadPercent = 0
    emitStatus()
    await autoUpdater.downloadUpdate()
  } catch (error) {
    setError(
      error instanceof Error ? error.message : 'Couldn’t download the update',
    )
  }
  return snapshot()
}

export function installSignedUpdate(): UpdateUiStatus {
  if (!app.isPackaged || !downloaded) {
    setError('No update is ready to install.')
    return snapshot()
  }
  autoUpdater.quitAndInstall()
  return snapshot()
}

function registerUpdateIpc(): void {
  if (handlersRegistered) return
  handlersRegistered = true

  ipcMain.handle('update:get-status', () => snapshot())
  ipcMain.handle('update:check', async () => checkForSignedUpdates())
  ipcMain.handle('update:download', async () => downloadSignedUpdate())
  ipcMain.handle('update:install', () => installSignedUpdate())
}
