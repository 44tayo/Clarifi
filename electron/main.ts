import * as path from 'path'

import { app, BrowserWindow, crashReporter, nativeTheme, screen, shell } from 'electron'

import { exchangeAuthToken, invalidateDeviceProfileCache } from './deviceAuth'
import { initErrorReporting } from './errorReporting'
import { registerHandlers } from './ipc/handlers'
import { loadRuntimeEnv } from './keys'
import { loadAudioPreferences } from './audioPreferences'
import { applyNativeTheme, THEME_WINDOW_BG } from './theme'
import { queueAuthUrl, takePendingAuthUrl } from './protocolAuth'
import { logStartup, stripMacQuarantine } from './startupDiagnostics'
import { installApplicationMenu } from './appMenu'
import { checkForSignedUpdates, configureUpdater } from './updater'
import { isAllowedExternalUrl } from './urlSafety'
import { startCalendarReminders } from './calendarReminders'
import { shouldStartHidden } from './loginItem'
import { startMeetingDetection } from './meetingDetection'
import { syncMeetingsWithCloud } from './meetingSync'

app.setName('Clarifi')

crashReporter.start({
  productName: 'Clarifi',
  companyName: 'Clarifi',
  submitURL: '',
  uploadToServer: false,
  compress: true,
})

logStartup('H2', 'main-module-loaded')
stripMacQuarantine()

if (process.platform === 'darwin') {
  app.commandLine.appendSwitch('disable-features', 'IOSurfaceCapturer')
}

const isDev = !app.isPackaged
const PROTOCOL = 'clarifi'

let mainWindow: BrowserWindow | null = null

async function handleAuthDeepLink(url: string): Promise<void> {
  const result = await exchangeAuthToken(url)
  if (result.ok) {
    console.log('Desktop connected via web auth')
    invalidateDeviceProfileCache()
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('auth:connected')
      }
    }
    void syncMeetingsWithCloud().then((sync) => {
      if (sync.ok) {
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send('meetings:changed')
          }
        }
      }
    })
  } else {
    console.error('Desktop auth exchange failed:', result.error)
  }
}

function registerProtocolClient(): void {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
        path.resolve(process.argv[1]),
      ])
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL)
  }
}

if (process.platform === 'darwin') {
  app.on('open-url', (event, url) => {
    event.preventDefault()
    if (url.startsWith(`${PROTOCOL}://`)) {
      if (app.isReady()) {
        void handleAuthDeepLink(url)
      } else {
        queueAuthUrl(url)
      }
    }
  })
}

/** Default open size: ~25cm × 16.5cm on a typical Mac display (~110 DIP/inch). */
const DEFAULT_WINDOW_WIDTH_CM = 25
const DEFAULT_WINDOW_HEIGHT_CM = 16.5
/** Logical pixels per inch — matches on-screen cm better than raw AppKit 72pt on Retina. */
const DEFAULT_WINDOW_DIP_PER_INCH = 110

function defaultMainWindowBounds(): { x: number; y: number; width: number; height: number } {
  const { x: ax, y: ay, width: aw, height: ah } = screen.getPrimaryDisplay().workArea
  const width = Math.min(
    aw,
    Math.max(720, Math.round((DEFAULT_WINDOW_WIDTH_CM / 2.54) * DEFAULT_WINDOW_DIP_PER_INCH)),
  )
  const height = Math.min(
    ah,
    Math.max(480, Math.round((DEFAULT_WINDOW_HEIGHT_CM / 2.54) * DEFAULT_WINDOW_DIP_PER_INCH)),
  )
  const x = Math.round(ax + (aw - width) / 2)
  const y = Math.round(ay + (ah - height) / 2)
  return { x, y, width, height }
}

function createMainWindow(options?: { show?: boolean }): BrowserWindow {
  const shouldShow = options?.show !== false
  const resolved = applyNativeTheme(loadAudioPreferences().theme)
  const bounds = defaultMainWindowBounds()
  const win = new BrowserWindow({
    ...bounds,
    minWidth: 720,
    minHeight: 480,
    show: false,
    title: 'Clarifi',
    backgroundColor: THEME_WINDOW_BG[resolved],
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 18 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // Re-apply after macOS/Electron frame restore so first paint matches the default.
  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return
    const next = defaultMainWindowBounds()
    win.setBounds(next, false)
    if (!shouldShow) return
    win.show()
    // Second pass after show — macOS sometimes restores a prior frame on first paint.
    setTimeout(() => {
      if (win.isDestroyed()) return
      win.setBounds(defaultMainWindowBounds(), false)
    }, 50)
  })

  if (isDev) {
    void win.loadURL('http://localhost:5173')
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url)
    } else {
      console.warn('Blocked window.open to disallowed scheme:', url)
    }
    return { action: 'deny' }
  })

  return win
}

function ensureMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow
  }
  mainWindow = createMainWindow({ show: true })
  return mainWindow
}

const gotLock = app.requestSingleInstanceLock()
logStartup('H3', 'single-instance-lock', { gotLock })
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`))
    if (url) {
      void handleAuthDeepLink(url)
    }
    const win = ensureMainWindow()
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  registerProtocolClient()

  app.whenReady().then(async () => {
    logStartup('H4', 'app-ready')
    loadRuntimeEnv()
    await initErrorReporting()
    logStartup('H4', 'error-reporting-ready')
    registerHandlers(() => mainWindow)
    logStartup('H5', 'handlers-registered')
    await configureUpdater(() => mainWindow)
    installApplicationMenu(() => mainWindow)

    const startHidden = shouldStartHidden()
    if (!startHidden) {
      mainWindow = createMainWindow({ show: true })
      logStartup('H5', 'main-window-created')
    } else {
      logStartup('H5', 'main-window-deferred-hidden-launch')
    }

    startCalendarReminders(() => mainWindow)
    // Detection + login-item keep running with no main window (macOS).
    startMeetingDetection(
      () => mainWindow,
      () => ensureMainWindow(),
    )
    void syncMeetingsWithCloud().then((sync) => {
      if (sync.ok && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('meetings:changed')
      }
    })

    const pending = takePendingAuthUrl()
    if (pending) {
      await handleAuthDeepLink(pending)
    }

    void checkForSignedUpdates()

    app.on('activate', () => {
      const win = ensureMainWindow()
      win.show()
      win.focus()
    })

    nativeTheme.on('updated', () => {
      if (loadAudioPreferences().theme === 'system') {
        applyNativeTheme('system')
      }
    })
  })

  app.on('window-all-closed', () => {
    // macOS: keep running so meeting detection can still show Take notes.
    if (process.platform !== 'darwin') {
      app.quit()
    } else {
      mainWindow = null
    }
  })
}
