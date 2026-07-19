import * as path from 'path'

import { app, BrowserWindow, crashReporter, shell } from 'electron'

import { exchangeAuthToken } from './deviceAuth'
import { registerHandlers } from './ipc/handlers'
import { loadRuntimeEnv } from './keys'
import { queueAuthUrl, takePendingAuthUrl } from './protocolAuth'
import { logStartup, stripMacQuarantine } from './startupDiagnostics'
import { checkForSignedUpdates, configureUpdater } from './updater'
import { isAllowedExternalUrl } from './urlSafety'

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
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('auth:connected')
      }
    }
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

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 880,
    minHeight: 560,
    title: 'Clarifi',
    backgroundColor: '#f7f8fc',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 18 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
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

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`))
    if (url) {
      void handleAuthDeepLink(url)
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  registerProtocolClient()

  app.whenReady().then(async () => {
    loadRuntimeEnv()
    registerHandlers(() => mainWindow)
    mainWindow = createMainWindow()

    const pending = takePendingAuthUrl()
    if (pending) {
      await handleAuthDeepLink(pending)
    }

    await configureUpdater()
    void checkForSignedUpdates()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
