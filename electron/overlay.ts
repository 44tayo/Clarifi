import { app, BrowserWindow, screen } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import {
  applyMacCaptureExclusion,
  isMacCaptureExclusionAvailable,
} from './windowCaptureExclude'
import {
  OVERLAY_HEIGHT_COLLAPSED,
  OVERLAY_HEIGHT_EXPANDED,
  OVERLAY_HEIGHT_CHAT,
  OVERLAY_WIDTH,
  clampPosition,
  clampSize,
  getDefaultPosition,
  loadOverlayPosition,
  loadOverlaySize,
  onOverlayMoved,
  saveOverlaySize,
  setFollowEnabled,
  setOverlayBounds,
  repositionOverlayToTopCenter,
  startOverlayFollow,
  stopOverlayFollow,
  toggleOverlayFollow as toggleFollowInternal,
  isOverlayFollowEnabled,
} from './overlayPosition'

export type ShowOverlayOptions = {
  /** Bring overlay to front and focus it (dock click, relaunch). */
  focus?: boolean
  /** Snap to top-center of the active display. Default true. */
  resetPosition?: boolean
}

let overlayReady = false
let overlayReadyWatchdog: NodeJS.Timeout | null = null

let overlayWindow: BrowserWindow | null = null
let displayMetricsListenerAttached = false

const SETTINGS_FILE = 'overlay-settings.json'

type OverlaySettings = {
  contentProtection: boolean
  followEnabled?: boolean
}

let contentProtectionEnabled = true

/**
 * Stealth on macOS 15+: CGSSetWindowCaptureExcludeShape (ScreenCaptureKit / Meet / Zoom).
 * Legacy fallback: setContentProtection when the native module is unavailable.
 */

function getSettingsFilePath(): string {
  return path.join(app.getPath('userData'), SETTINGS_FILE)
}

function loadOverlaySettings(): void {
  try {
    const raw = fs.readFileSync(getSettingsFilePath(), 'utf-8')
    const parsed = JSON.parse(raw) as OverlaySettings
    if (typeof parsed.contentProtection === 'boolean') {
      contentProtectionEnabled = parsed.contentProtection
    }
    if (typeof parsed.followEnabled === 'boolean') {
      setFollowEnabled(parsed.followEnabled)
    }
  } catch {
    contentProtectionEnabled = true
  }
}

function saveOverlaySettings(): void {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(
      getSettingsFilePath(),
      JSON.stringify({
        contentProtection: contentProtectionEnabled,
        followEnabled: isOverlayFollowEnabled(),
      }),
    )
  } catch (err) {
    console.error('Failed to save overlay settings:', err)
  }
}

function logStealth(message: string, details?: Record<string, unknown>): void {
  if (details) {
    console.log(`[stealth] ${message}`, details)
  } else {
    console.log(`[stealth] ${message}`)
  }
}

function warnStealth(message: string, details?: Record<string, unknown>): void {
  if (details) {
    console.warn(`[stealth] ${message}`, details)
  } else {
    console.warn(`[stealth] ${message}`)
  }
}

function usesMacCaptureExclusion(): boolean {
  return process.platform === 'darwin' && isMacCaptureExclusionAvailable()
}

function applyStealthProtection(window: BrowserWindow): void {
  if (window.isDestroyed()) return

  const stealthOn = contentProtectionEnabled

  if (process.platform === 'darwin') {
    const handle = window.getNativeWindowHandle()
    // CGSSetWindowCaptureExcludeShape leaves a grey placeholder in Google Meet / Zoom
    // ScreenCaptureKit feeds. Clear it before applying sharingType-based protection.
    const cgsCleared = applyMacCaptureExclusion(handle, false)
    window.setContentProtection(stealthOn)
    window.setBackgroundColor('#00000000')
    logStealth('stealth apply', {
      stealthOn,
      method: 'setContentProtection',
      cgsCleared,
      macNative: usesMacCaptureExclusion(),
    })
    return
  }

  if (process.platform === 'win32') {
    window.setContentProtection(stealthOn)
    logStealth('setContentProtection', { stealthOn })
  }
}

function broadcastProtectionState(): void {
  const payload = { enabled: contentProtectionEnabled }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('overlay:protection-changed', payload)
  }
}

/** Follow ON: visible on all Spaces. Pin ON: stays on current Space only. */
function applyWorkspaceVisibility(window: BrowserWindow): void {
  if (window.isDestroyed()) return
  const follow = isOverlayFollowEnabled()
  if (follow) {
    if (process.platform === 'darwin') {
      window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    } else {
      window.setVisibleOnAllWorkspaces(true)
    }
  } else {
    window.setVisibleOnAllWorkspaces(false)
  }
}

/** Re-apply workspace, stealth, and z-order after hide/show (e.g. screen capture). */
export function reapplyOverlayWindowPolicies(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    applyOverlayWindowPolicies(overlayWindow)
    broadcastProtectionState()
  }
}

/** Apply workspace, stealth, and z-order. Stealth runs AFTER workspace visibility. */
function applyOverlayWindowPolicies(window: BrowserWindow): void {
  if (window.isDestroyed()) return
  applyWorkspaceVisibility(window)
  applyStealthProtection(window)
  if (process.platform === 'darwin') {
    window.setAlwaysOnTop(true, 'floating', 1)
  } else {
    window.setAlwaysOnTop(true)
  }
}

function attachDisplayMetricsListener(): void {
  if (displayMetricsListenerAttached || process.platform !== 'darwin') return
  displayMetricsListenerAttached = true
  screen.on('display-metrics-changed', () => {
    if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
      applyStealthProtection(overlayWindow)
      logStealth('re-applied after display-metrics-changed')
    }
  })
}

function scheduleStealthApply(): void {
  if (process.platform !== 'darwin') return
  for (const delay of [0, 50, 150, 400, 1000]) {
    setTimeout(() => {
      if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
        applyStealthProtection(overlayWindow)
      }
    }, delay)
  }
}

export function setContentProtectionEnabled(enabled: boolean): void {
  contentProtectionEnabled = enabled
  const macNative = usesMacCaptureExclusion()
  logStealth('toggle', { enabled, macNative })

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    applyStealthProtection(overlayWindow)
    if (process.platform === 'darwin') {
      scheduleStealthApply()
    }
  }
  saveOverlaySettings()
  broadcastProtectionState()
}

export function toggleContentProtection(): boolean {
  setContentProtectionEnabled(!contentProtectionEnabled)
  return contentProtectionEnabled
}

export function isContentProtectionEnabled(): boolean {
  return contentProtectionEnabled
}

export function toggleOverlayFollow(): boolean {
  const enabled = toggleFollowInternal()
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    applyOverlayWindowPolicies(overlayWindow)
  }
  saveOverlaySettings()
  return enabled
}

export {
  OVERLAY_WIDTH,
  OVERLAY_HEIGHT_COLLAPSED,
  OVERLAY_HEIGHT_EXPANDED,
  OVERLAY_HEIGHT_CHAT,
  isOverlayFollowEnabled,
}

function clearOverlayReadyWatchdog(): void {
  if (overlayReadyWatchdog) {
    clearTimeout(overlayReadyWatchdog)
    overlayReadyWatchdog = null
  }
}

function handleOverlayLoadFailure(reason: string): void {
  console.error(`[overlay] load failed: ${reason}`)
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  if (!app.isPackaged) {
    overlayWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

function scheduleOverlayReadyWatchdog(): void {
  if (app.isPackaged || overlayReady) return
  clearOverlayReadyWatchdog()
  overlayReadyWatchdog = setTimeout(() => {
    if (overlayReady || !overlayWindow || overlayWindow.isDestroyed()) return
    console.warn('[overlay] renderer did not signal ready — reloading overlay')
    overlayWindow.webContents.openDevTools({ mode: 'detach' })
    const devUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173'
    void overlayWindow.loadURL(`${devUrl}/overlay.html`)
  }, 5000)
}

export function markOverlayReady(): void {
  overlayReady = true
  clearOverlayReadyWatchdog()
}

export function showOverlayWindow(options: ShowOverlayOptions = {}): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  const resetPosition = options.resetPosition !== false
  if (resetPosition) {
    repositionOverlayToTopCenter(overlayWindow)
  }
  if (options.focus) {
    overlayWindow.show()
    overlayWindow.focus()
  } else {
    overlayWindow.showInactive()
  }
  if (process.platform === 'darwin') {
    overlayWindow.moveTop()
  }
  applyOverlayWindowPolicies(overlayWindow)
}

/** Show overlay on the active display — used at launch and when user re-activates the app. */
export function ensureOverlayVisible(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    createOverlayWindow()
    return
  }
  showOverlayWindow({ focus: true, resetPosition: true })
}

export function createOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    showOverlayWindow({ focus: true, resetPosition: true })
    return overlayWindow
  }

  loadOverlaySettings()
  attachDisplayMetricsListener()

  if (process.platform === 'darwin') {
    logStealth('startup', {
      macNative: usesMacCaptureExclusion(),
      stealthOn: contentProtectionEnabled,
    })
  }

  const saved = loadOverlayPosition()
  const savedSize = loadOverlaySize()
  const initialWidth = savedSize.width
  const initialHeight = OVERLAY_HEIGHT_COLLAPSED
  const initial = clampPosition(
    saved?.x ?? getDefaultPosition(initialWidth, initialHeight).x,
    saved?.y ?? getDefaultPosition(initialWidth, initialHeight).y,
    initialWidth,
    initialHeight,
  )

  overlayWindow = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    x: initial.x,
    y: initial.y,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: true,
    acceptFirstMouse: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  attachMovePersistence(overlayWindow)
  startOverlayFollow(overlayWindow)
  applyOverlayWindowPolicies(overlayWindow)
  setOverlayInteractive(true)

  overlayWindow.on('resize', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      applyStealthProtection(overlayWindow)
    }
  })

  overlayWindow.on('show', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      applyOverlayWindowPolicies(overlayWindow)
    }
  })

  overlayWindow.once('ready-to-show', () => {
    showOverlayWindow({ focus: true, resetPosition: true })
    scheduleStealthApply()
    scheduleOverlayReadyWatchdog()
  })

  overlayWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    handleOverlayLoadFailure(`${errorCode} ${errorDescription}`)
  })

  overlayWindow.webContents.on('did-finish-load', () => {
    scheduleOverlayReadyWatchdog()
  })

  const isDev = !app.isPackaged
  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173'
    const loadDevOverlay = () => {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        void overlayWindow.loadURL(`${devUrl}/overlay.html`)
      }
    }
    loadDevOverlay()
  } else {
    if (!overlayWindow.isDestroyed()) {
      overlayWindow.loadFile(path.join(__dirname, '../dist/overlay.html'))
    }
  }

  return overlayWindow
}

function attachMovePersistence(window: BrowserWindow): void {
  window.on('moved', () => {
    onOverlayMoved(window)
    applyStealthProtection(window)
  })
}

export function destroyOverlayWindow(): void {
  clearOverlayReadyWatchdog()
  overlayReady = false
  stopOverlayFollow()
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy()
  }
  overlayWindow = null
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow
}

export function toggleOverlayVisibility(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  if (overlayWindow.isVisible()) {
    overlayWindow.hide()
  } else {
    showOverlayWindow({ focus: true, resetPosition: true })
  }
}

export function nudgeOverlayWindow(dx: number, dy: number): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  const bounds = overlayWindow.getBounds()
  const position = clampPosition(bounds.x + dx, bounds.y + dy, bounds.width, bounds.height)
  setOverlayBounds(overlayWindow, position.x, position.y, bounds.width, bounds.height, true)
}

function applyOverlayMousePolicy(window: BrowserWindow, interactive: boolean): void {
  if (window.isDestroyed()) return
  window.setIgnoreMouseEvents(!interactive, { forward: true })
}

export function setOverlayInteractive(interactive: boolean): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  overlayWindow.setFocusable(interactive)
  applyOverlayMousePolicy(overlayWindow, interactive)
  if (interactive) {
    overlayWindow.focus()
  }
}

export function setOverlayHeight(height: number): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  const { width } = overlayWindow.getBounds()
  setOverlaySize(width, height)
}

export function setOverlaySize(
  width: number,
  height: number,
  persist = true,
  x?: number,
  y?: number,
): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  const clamped = clampSize(width, height)
  const [currentX, currentY] = overlayWindow.getPosition()
  const posX = typeof x === 'number' && Number.isFinite(x) ? x : currentX
  const posY = typeof y === 'number' && Number.isFinite(y) ? y : currentY
  const position = clampPosition(posX, posY, clamped.width, clamped.height)
  setOverlayBounds(
    overlayWindow,
    position.x,
    position.y,
    clamped.width,
    clamped.height,
    true,
  )
  if (persist) {
    saveOverlaySize(clamped.width, clamped.height)
  }
  applyStealthProtection(overlayWindow)
}

export function getOverlaySize(): { width: number; height: number } {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return loadOverlaySize()
  }
  const bounds = overlayWindow.getBounds()
  return { width: bounds.width, height: bounds.height }
}
