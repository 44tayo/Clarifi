import { app, BrowserWindow, desktopCapturer, shell, systemPreferences } from 'electron'

export type PermissionKind = 'accessibility' | 'microphone' | 'screen'

export type PermissionStatuses = {
  accessibility: boolean
  microphone: boolean
  screen: boolean
}

export type PermissionStatusPayload = PermissionStatuses & {
  allGranted: boolean
  execPath: string
}

let cachedScreenGranted: boolean | null = null
let screenProbeInFlight: Promise<boolean> | null = null
let lastAccessibilityTrusted = false
let onAccessibilityGranted: (() => void) | null = null

function mapMediaStatus(status: string): boolean {
  return status === 'granted'
}

export function setOnAccessibilityGranted(handler: (() => void) | null): void {
  onAccessibilityGranted = handler
}

export async function probeScreenPermission(): Promise<boolean> {
  if (process.platform !== 'darwin') return true

  if (mapMediaStatus(systemPreferences.getMediaAccessStatus('screen'))) {
    cachedScreenGranted = true
    return true
  }

  if (cachedScreenGranted === true) return true

  if (screenProbeInFlight) return screenProbeInFlight

  screenProbeInFlight = (async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1, height: 1 },
      })
      const granted = sources.some((source) => {
        const thumb = source.thumbnail
        return thumb && !thumb.isEmpty()
      })
      cachedScreenGranted = granted
      return granted
    } catch {
      cachedScreenGranted = false
      return false
    } finally {
      screenProbeInFlight = null
    }
  })()

  return screenProbeInFlight
}

export function getPermissionStatuses(): PermissionStatuses {
  const accessibility =
    process.platform === 'darwin'
      ? systemPreferences.isTrustedAccessibilityClient(false)
      : true

  const microphone =
    process.platform === 'darwin'
      ? mapMediaStatus(systemPreferences.getMediaAccessStatus('microphone'))
      : true

  let screen = true
  if (process.platform === 'darwin') {
    screen =
      mapMediaStatus(systemPreferences.getMediaAccessStatus('screen')) ||
      cachedScreenGranted === true
  }

  return { accessibility, microphone, screen }
}

export async function getPermissionStatusPayload(): Promise<PermissionStatusPayload> {
  const screenGranted = await probeScreenPermission()
  const statuses = getPermissionStatuses()
  const screen = statuses.screen || screenGranted

  return {
    accessibility: statuses.accessibility,
    microphone: statuses.microphone,
    screen,
    allGranted: statuses.accessibility && statuses.microphone && screen,
    execPath: process.execPath,
  }
}

export function allPermissionsGranted(statuses: PermissionStatuses): boolean {
  return statuses.accessibility && statuses.microphone && statuses.screen
}

export async function requestPermission(kind: PermissionKind): Promise<boolean> {
  if (process.platform !== 'darwin') {
    return true
  }

  switch (kind) {
    case 'accessibility': {
      const trusted = systemPreferences.isTrustedAccessibilityClient(true)
      if (!trusted) {
        openPermissionSettings('accessibility')
      }
      return systemPreferences.isTrustedAccessibilityClient(false)
    }
    case 'microphone':
      return systemPreferences.askForMediaAccess('microphone')
    case 'screen':
      openPermissionSettings('screen')
      return probeScreenPermission()
    default:
      return false
  }
}

export function openPermissionSettings(kind: PermissionKind): void {
  if (process.platform !== 'darwin') {
    return
  }

  const urls: Record<PermissionKind, string> = {
    accessibility:
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
    microphone:
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
    screen:
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  }

  void shell.openExternal(urls[kind])
}

export async function broadcastPermissionStatuses(): Promise<PermissionStatusPayload> {
  const payload = await getPermissionStatusPayload()

  if (payload.accessibility && !lastAccessibilityTrusted && onAccessibilityGranted) {
    onAccessibilityGranted()
  }
  lastAccessibilityTrusted = payload.accessibility

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('permissions:changed', payload)
    }
  }

  return payload
}

export function attachPermissionFocusListeners(): void {
  const refresh = () => {
    void broadcastPermissionStatuses()
  }

  app.on('activate', refresh)
  app.on('browser-window-focus', (_event, window) => {
    if (!window.isDestroyed()) refresh()
  })
}
