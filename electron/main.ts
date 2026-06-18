import * as path from 'path'

import { app, BrowserWindow, dialog, globalShortcut } from 'electron'
import { logStartup, stripMacQuarantine } from './startupDiagnostics'
import { registerKeybinds } from './keybindManager'
import { exchangeAuthToken } from './deviceAuth'
import { registerHandlers } from './ipc/handlers'
import { loadRuntimeEnv } from './keys'
import {
  createOnboardingWindow,
  getOnboardingWindow,
  notifyOnboardingAuthConnected,
} from './onboarding'
import { isOnboardingComplete } from './onboardingState'
import { queueAuthUrl, takePendingAuthUrl } from './protocolAuth'
import { checkForSignedUpdates, configureUpdater } from './updater'
import {
  createOverlayWindow,
  destroyOverlayWindow,
  ensureOverlayVisible,
  getOverlayWindow,
} from './overlay'
import { stopOverlayFollow } from './overlayPosition'
// Show "Clarifi" in the menu bar instead of "Electron" during local dev.
app.setName('Clarifi')

logStartup('H2', 'main-module-loaded')
stripMacQuarantine()

// Best-effort: helps setContentProtection on older macOS capture paths (may not affect ScreenCaptureKit/Meet)
if (process.platform === 'darwin') {
  app.commandLine.appendSwitch('disable-features', 'IOSurfaceCapturer')
}

const isDev = !app.isPackaged
const PROTOCOL = 'clarifi'
const useDevShell = isDev && process.env.CLARIFI_DEV_SHELL === '1'

let mainWindow: BrowserWindow | null = null

async function handleGmailConnectedDeepLink(): Promise<void> {
  console.log('[gmail] OAuth complete — refreshing connection status')
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('gmail:connection-update', { connected: true })
    }
  }
}

async function handleProtocolUrl(url: string): Promise<void> {
  if (url.includes('gmail-connected') || url.includes('integration/gmail')) {
    await handleGmailConnectedDeepLink()
    return
  }
  await handleAuthDeepLink(url)
}

async function handleAuthDeepLink(url: string): Promise<void> {
  const result = await exchangeAuthToken(url)
  if (result.ok) {
    console.log('Desktop connected via web auth')
    notifyOnboardingAuthConnected()
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
        void handleProtocolUrl(url)
      } else {
        queueAuthUrl(url)
      }
    }
  })
}

async function showClarifiUI(): Promise<void> {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.show()
  }

  const onboardingDone = await isOnboardingComplete()
  if (!onboardingDone) {
    destroyOverlayWindow()
    const onboarding = createOnboardingWindow()
    onboarding.focus()
    return
  }

  if (useDevShell && (!mainWindow || mainWindow.isDestroyed())) {
    createDevShellWindow()
    mainWindow?.focus()
    return
  }

  ensureOverlayVisible()
}

// Dev builds skip the singleton lock so a stale dev process cannot block Clarifi.app.
const gotLock = app.isPackaged ? app.requestSingleInstanceLock() : true
if (!gotLock) {
  logStartup('H3', 'single-instance-lock-denied')
  app.quit()
} else {
  logStartup('H3', 'single-instance-lock-acquired', { packaged: app.isPackaged })
  if (app.isPackaged) {
    app.on('second-instance', (_event, argv) => {
      logStartup('H3', 'second-instance-received')
      const authUrl = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`))
      if (authUrl) void handleProtocolUrl(authUrl)
      void showClarifiUI()
    })
  }
}

/** Optional legacy dev shell (index.html / MyApp). Off by default — overlay only. */
function createDevShellWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Clarifi Dev',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      allowRunningInsecureContent: false,
    },
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('file://')) {
      event.preventDefault()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.openDevTools()

  const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173'
  mainWindow.loadURL(devServerUrl)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

async function initializeStorage(): Promise<void> {
  try {
    const { getKey } = await import('./store')
    await getKey('__storage_healthcheck__')
  } catch (err) {
    console.error('Storage init failed:', err)
  }

  try {
    const { initializeMemory } = await import('./memory')
    initializeMemory()
    console.log('[memory] database ready')
  } catch (err) {
    console.error('Memory database init failed:', err)
  }
}

async function launchClarifi(): Promise<void> {
  const onboardingDone = await isOnboardingComplete()

  if (!onboardingDone) {
    destroyOverlayWindow()
    createOnboardingWindow()
    return
  }

  if (useDevShell) {
    createDevShellWindow()
  }

  createOverlayWindow()
  ensureOverlayVisible()
}

app.whenReady().then(async () => {
  logStartup('H2', 'app-ready')
  try {
    loadRuntimeEnv()
    registerProtocolClient()

    const pending = takePendingAuthUrl()
    if (pending) await handleProtocolUrl(pending)

    if (!isDev && process.argv.length > 1) {
      const authArg = process.argv.find((arg) => arg.startsWith(`${PROTOCOL}://`))
      if (authArg) await handleProtocolUrl(authArg)
    }

    try {
      await configureUpdater()
    } catch (err) {
      console.error('Updater configuration failed:', err)
    }

    await initializeStorage()
    registerHandlers()
    const { initializeProactiveEngine } = await import('./proactive')
    initializeProactiveEngine()
    await launchClarifi()
    registerKeybinds()
    logStartup('H4', 'launch-complete', {
      windowCount: BrowserWindow.getAllWindows().length,
    })

    if (!isDev) {
      void checkForSignedUpdates()
    }
  } catch (err) {
    console.error('Clarifi startup failed:', err)
    logStartup('H2', 'startup-failed', { error: String(err) })
    destroyOverlayWindow()
    createOnboardingWindow()
    if (app.isPackaged) {
      dialog.showErrorBox(
        'Clarifi could not start',
        'Clarifi hit a startup error. Quit any stuck Clarifi processes in Activity Monitor, then right-click Clarifi in Applications and choose Open.',
      )
    }
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopOverlayFollow()
  void import('./proactive').then(({ stopProactiveEngine }) => stopProactiveEngine())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  const onboarding = getOnboardingWindow()
  if (onboarding && !onboarding.isDestroyed()) {
    onboarding.focus()
    return
  }
  void showClarifiUI()
})
