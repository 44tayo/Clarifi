import { execSync } from 'child_process'
import { clipboard, screen, systemPreferences, BrowserWindow } from 'electron'
import { runOsascript, runOsascriptAsync } from './osascript'
import {
  getFrontmostAppNameCached,
  inferDictationSurface,
  type DictationSurface,
} from './proactive/textExtraction'

let lastExternalFrontmostApp: string | null = null
let trackingTimer: ReturnType<typeof setInterval> | null = null
let followRefreshTimer: ReturnType<typeof setInterval> | null = null
let followRefreshInFlight = false
let lastTrackAt = 0

const CLARIFI_APP_NAMES = new Set(['clarifi', 'electron'])
const WINDOW_CENTER_CACHE_MS = 5000
const TRACK_INTERVAL_MS = 5000
const FOLLOW_REFRESH_MS = 1000
const TRACK_THROTTLE_MS = 4000

let windowCenterCache: {
  key: string
  center: { x: number; y: number }
  at: number
} | null = null

function cachedWindowCenter(
  key: string,
  lookup: () => { x: number; y: number } | null,
): { x: number; y: number } | null {
  const now = Date.now()
  if (
    windowCenterCache &&
    windowCenterCache.key === key &&
    now - windowCenterCache.at < WINDOW_CENTER_CACHE_MS
  ) {
    return windowCenterCache.center
  }
  const center = lookup()
  if (center) windowCenterCache = { key, center, at: now }
  return center
}

export type DictationTargetSnapshot = {
  app: string
  displayId: number
  windowTitle?: string
  fieldPreview?: string
  cursor?: { x: number; y: number }
}

function parseCenterCsv(result: string): { x: number; y: number } | null {
  const [xRaw, yRaw] = result.split(',')
  const x = Number(xRaw)
  const y = Number(yRaw)
  if (Number.isFinite(x) && Number.isFinite(y)) return { x, y }
  return null
}

function getFrontmostWindowCenterSync(): { x: number; y: number } | null {
  if (process.platform === 'darwin') {
    const script = `
tell application "System Events"
  set frontProc to first application process whose frontmost is true
  try
    tell frontProc
      set frontWin to first window whose frontmost is true
      set winPos to position of frontWin
      set winSize to size of frontWin
      set cx to (item 1 of winPos) + (item 1 of winSize) / 2
      set cy to (item 2 of winPos) + (item 2 of winSize) / 2
      return (cx as text) & "," & (cy as text)
    end tell
  end try
end tell
`
    return cachedWindowCenter('frontmost', () => {
      const result = runOsascript(script, 1500)
      return result ? parseCenterCsv(result) : null
    })
  }

  if (process.platform === 'win32') {
    try {
      const result = execSync(
        `powershell -NoProfile -Command "Add-Type @' using System; using System.Runtime.InteropServices; public class W { [DllImport(\\\"user32.dll\\\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\\\"user32.dll\\\")] public static extern bool GetWindowRect(IntPtr h, out RECT r); public struct RECT { public int L,T,R,B; } } '@; $h=[W]::GetForegroundWindow(); $r=New-Object W+RECT; [W]::GetWindowRect($h,[ref]$r)|Out-Null; Write-Output (($r.L+$r.R)/2); Write-Output (($r.T+$r.B)/2)"`,
        { encoding: 'utf-8', timeout: 2000 },
      ).trim()
      const lines = result.split(/\r?\n/).filter(Boolean)
      const x = Number(lines[0])
      const y = Number(lines[1])
      if (Number.isFinite(x) && Number.isFinite(y)) return { x, y }
    } catch {
      return null
    }
  }

  return null
}

function getWindowCenterForAppSync(appName: string): { x: number; y: number } | null {
  if (process.platform === 'darwin') {
    const escaped = appName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    const script = `
tell application "System Events"
  tell process "${escaped}"
    if (count of windows) > 0 then
      set frontWin to window 1
      set winPos to position of frontWin
      set winSize to size of frontWin
      set cx to (item 1 of winPos) + (item 1 of winSize) / 2
      set cy to (item 2 of winPos) + (item 2 of winSize) / 2
      return (cx as text) & "," & (cy as text)
    end if
  end tell
end tell
`
    return cachedWindowCenter(`app:${appName}`, () => {
      const result = runOsascript(script, 1500)
      return result ? parseCenterCsv(result) : null
    })
  }

  if (process.platform === 'win32') {
    try {
      const safeName = appName.replace(/'/g, "''")
      const result = execSync(
        `powershell -NoProfile -Command "$p = Get-Process -Name '${safeName}' -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p -and $p.MainWindowHandle -ne 0) { Add-Type @' using System; using System.Runtime.InteropServices; public class W { [DllImport(\\\"user32.dll\\\")] public static extern bool GetWindowRect(IntPtr h, out RECT r); public struct RECT { public int L,T,R,B; } } '@; $r=New-Object W+RECT; [W]::GetWindowRect($p.MainWindowHandle,[ref]$r)|Out-Null; Write-Output (($r.L+$r.R)/2); Write-Output (($r.T+$r.B)/2) }"`,
        { encoding: 'utf-8', timeout: 2000 },
      ).trim()
      const lines = result.split(/\r?\n/).filter(Boolean)
      const x = Number(lines[0])
      const y = Number(lines[1])
      if (Number.isFinite(x) && Number.isFinite(y)) return { x, y }
    } catch {
      return null
    }
  }

  return null
}

function displayIdFromCenter(center: { x: number; y: number }): number {
  return screen.getDisplayNearestPoint(center).id
}

function readFrontWindowTitle(): string | undefined {
  if (process.platform !== 'darwin') return undefined

  const script = `
tell application "System Events"
  set frontProc to first application process whose frontmost is true
  try
    tell frontProc
      set frontWin to first window whose frontmost is true
      return name of frontWin as text
    end tell
  end try
end tell
`
  const title = runOsascript(script, 1500)
  return title?.trim() || undefined
}

export function getFrontmostAppDisplayId(): number {
  const center = getFrontmostWindowCenterSync()
  if (center) return displayIdFromCenter(center)
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id
}

/**
 * Display for dictation pill positioning — prefers the frontmost window's display
 * so Cmd+Tab / monitor switches move the pill without requiring cursor movement.
 */
export function getFollowDisplayId(): number {
  return getActiveDisplayIdForPill()
}

export function getActiveDisplayIdForPill(): number {
  return getFrontmostAppDisplayId()
}

async function refreshFollowDisplayAsync(): Promise<void> {
  if (followRefreshInFlight || process.platform !== 'darwin') return
  followRefreshInFlight = true
  try {
    const frontScript = `tell application "System Events" to get name of first application process whose frontmost is true`
    const frontName = (await runOsascriptAsync(frontScript, 1500))?.trim() || null

    if (frontName && !isClarifiProcess(frontName)) {
      lastExternalFrontmostApp = frontName
      const centerScript = `
tell application "System Events"
  set frontProc to first application process whose frontmost is true
  try
    tell frontProc
      set frontWin to first window whose frontmost is true
      set winPos to position of frontWin
      set winSize to size of frontWin
      set cx to (item 1 of winPos) + (item 1 of winSize) / 2
      set cy to (item 2 of winPos) + (item 2 of winSize) / 2
      return (cx as text) & "," & (cy as text)
    end tell
  end try
end tell
`
      const centerResult = await runOsascriptAsync(centerScript, 1500)
      const center = centerResult ? parseCenterCsv(centerResult) : null
      if (center) {
        displayIdFromCenter(center)
        return
      }
    }

    const external = lastExternalFrontmostApp
    if (external && !isClarifiProcess(external)) {
      const escaped = external.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      const appScript = `
tell application "System Events"
  tell process "${escaped}"
    if (count of windows) > 0 then
      set frontWin to window 1
      set winPos to position of frontWin
      set winSize to size of frontWin
      set cx to (item 1 of winPos) + (item 1 of winSize) / 2
      set cy to (item 2 of winPos) + (item 2 of winSize) / 2
      return (cx as text) & "," & (cy as text)
    end if
  end tell
end tell
`
      const centerResult = await runOsascriptAsync(appScript, 1500)
      const center = centerResult ? parseCenterCsv(centerResult) : null
      if (center) {
        displayIdFromCenter(center)
      }
    }
  } finally {
    followRefreshInFlight = false
  }
}

export function startFollowDisplayRefresh(): void {
  if (followRefreshTimer) return
  void refreshFollowDisplayAsync()
  followRefreshTimer = setInterval(() => {
    void refreshFollowDisplayAsync()
  }, FOLLOW_REFRESH_MS)
}

export function stopFollowDisplayRefresh(): void {
  if (followRefreshTimer) {
    clearInterval(followRefreshTimer)
    followRefreshTimer = null
  }
  followRefreshInFlight = false
}

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function isClarifiWindowUrl(url: string): boolean {
  return url.includes('overlay.html') || url.includes('dictation-pill.html')
}

function isPointInClarifiWindow(x: number, y: number): boolean {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || !win.isVisible()) continue
    const url = win.webContents.getURL()
    if (!isClarifiWindowUrl(url)) continue
    const bounds = win.getBounds()
    if (
      x >= bounds.x &&
      x <= bounds.x + bounds.width &&
      y >= bounds.y &&
      y <= bounds.y + bounds.height
    ) {
      return true
    }
  }
  return false
}

function getAppAtScreenPoint(x: number, y: number): string | null {
  if (process.platform === 'darwin') {
    const script = `
tell application "System Events"
  set px to ${Math.round(x)}
  set py to ${Math.round(y)}
  repeat with proc in application processes
    if visible of proc then
      set procName to name of proc as text
      if procName is not "Clarifi" and procName does not contain "Electron" then
        try
          repeat with win in windows of proc
            set winPos to position of win
            set winSize to size of win
            set leftEdge to item 1 of winPos
            set topEdge to item 2 of winPos
            set rightEdge to leftEdge + (item 1 of winSize)
            set bottomEdge to topEdge + (item 2 of winSize)
            if px >= leftEdge and px <= rightEdge and py >= topEdge and py <= bottomEdge then
              return procName
            end if
          end repeat
        end try
      end if
    end if
  end repeat
end tell
return ""
`
    const result = runOsascript(script, 2500)
    const name = result?.trim()
    if (name && !isClarifiProcess(name)) return name
    return null
  }

  if (process.platform === 'win32') {
    try {
      const result = execSync(
        `powershell -NoProfile -Command "Add-Type @' using System; using System.Runtime.InteropServices; using System.Text; public class W { [DllImport(\\\"user32.dll\\\")] public static extern IntPtr WindowFromPoint(System.Drawing.Point p); [DllImport(\\\"user32.dll\\\")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int c); [DllImport(\\\"user32.dll\\\")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint id); } '@; $p=New-Object System.Drawing.Point ${Math.round(x)},${Math.round(y)}; $h=[W]::WindowFromPoint($p); if ($h -eq [IntPtr]::Zero) { exit 1 }; [uint32]$pid=0; [void][W]::GetWindowThreadProcessId($h,[ref]$pid); if ($pid -gt 0) { (Get-Process -Id $pid).ProcessName }"`,
        { encoding: 'utf-8', timeout: 2500 },
      ).trim()
      if (result && !isClarifiProcess(result)) return result
    } catch {
      return null
    }
  }

  return null
}

function readWindowTitleForProcess(appName: string): string | undefined {
  if (process.platform !== 'darwin') return undefined
  const escaped = escapeAppleScriptString(appName)
  const script = `
tell application "System Events"
  tell process "${escaped}"
    try
      if (count of windows) > 0 then
        return name of window 1 as text
      end if
    end try
  end tell
end tell
return ""
`
  const title = runOsascript(script, 1500)
  return title?.trim() || undefined
}

function readFocusedFieldInProcess(appName: string): string | null {
  if (!accessibilityTrusted()) return null
  if (process.platform !== 'darwin') return null

  const escaped = escapeAppleScriptString(appName)
  const script = `
tell application "System Events"
  tell process "${escaped}"
    try
      set focusedEl to value of attribute "AXFocusedUIElement"
      try
        set focusedValue to value of focusedEl
        if focusedValue is not missing value then
          return focusedValue as text
        end if
      end try
    end try
  end tell
end tell
return ""
`
  const value = runOsascript(script, 4000)
  if (!value) return null
  return value.trim() || null
}

function setFocusedFieldInProcess(appName: string, nextValue: string): boolean {
  if (!accessibilityTrusted()) return false
  if (process.platform !== 'darwin') return false

  const escapedApp = escapeAppleScriptString(appName)
  const payload = nextValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const script = `
tell application "System Events"
  tell process "${escapedApp}"
    try
      set focusedEl to value of attribute "AXFocusedUIElement"
      set value of focusedEl to "${payload}"
      return "ok"
    end try
  end tell
end tell
return "fail"
`
  return runOsascript(script, 4000) === 'ok'
}

function resolveCaptureTargetApp(cursor: { x: number; y: number }): string | null {
  const currentFront = getFrontmostAppNameCached(true)
  const clarifiFrontmost = isClarifiProcess(currentFront)
  const onClarifiUi = isPointInClarifiWindow(cursor.x, cursor.y)

  if (currentFront && !clarifiFrontmost) {
    return currentFront
  }

  if (lastExternalFrontmostApp && !isClarifiProcess(lastExternalFrontmostApp)) {
    if (clarifiFrontmost || onClarifiUi) {
      return lastExternalFrontmostApp
    }
  }

  if (!onClarifiUi) {
    const underCursor = getAppAtScreenPoint(cursor.x, cursor.y)
    if (underCursor && !isClarifiProcess(underCursor)) {
      return underCursor
    }
  }

  if (lastExternalFrontmostApp && !isClarifiProcess(lastExternalFrontmostApp)) {
    return lastExternalFrontmostApp
  }

  return null
}

/** Snapshot target app + display at session start — frozen for insert. */
export function captureDictationTarget(): DictationTargetSnapshot | null {
  trackExternalFrontmostApp(true)
  const cursor = screen.getCursorScreenPoint()
  const app = resolveCaptureTargetApp(cursor)
  if (!app || isClarifiProcess(app)) return null

  const fieldPreview = readFocusedFieldInProcess(app)?.slice(0, 80)
  const windowTitle = readWindowTitleForProcess(app) ?? readFrontWindowTitle()
  const displayId = screen.getDisplayNearestPoint(cursor).id

  return {
    app,
    displayId,
    windowTitle,
    fieldPreview: fieldPreview || undefined,
    cursor: { x: cursor.x, y: cursor.y },
  }
}

export function isClarifiProcess(appName: string | null | undefined): boolean {
  if (!appName) return false
  const lower = appName.toLowerCase()
  for (const name of CLARIFI_APP_NAMES) {
    if (lower.includes(name)) return true
  }
  return false
}

/** Remember the last app the user was working in (not Clarifi). */
export function trackExternalFrontmostApp(force = false): void {
  const now = Date.now()
  if (!force && now - lastTrackAt < TRACK_THROTTLE_MS) return
  lastTrackAt = now

  const app = getFrontmostAppNameCached(force)
  if (app && !isClarifiProcess(app)) {
    lastExternalFrontmostApp = app
  }
}

/** Slow background poll for dictation target — not on the UI hot path. */
export function startDictationTargetTracking(): void {
  if (trackingTimer) return
  trackExternalFrontmostApp(true)
  startFollowDisplayRefresh()
  trackingTimer = setInterval(() => {
    trackExternalFrontmostApp(false)
  }, TRACK_INTERVAL_MS)
}

export function stopDictationTargetTracking(): void {
  if (trackingTimer) {
    clearInterval(trackingTimer)
    trackingTimer = null
  }
  stopFollowDisplayRefresh()
}

export function getDictationTargetApp(): string | null {
  const current = getFrontmostAppNameCached(false)
  if (current && !isClarifiProcess(current)) return current
  return lastExternalFrontmostApp
}

function accessibilityTrusted(): boolean {
  return (
    process.platform === 'darwin' &&
    systemPreferences.isTrustedAccessibilityClient(false)
  )
}

function activateApplication(appName: string): boolean {
  if (process.platform === 'darwin') {
    const escaped = appName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return runOsascript(`tell application "${escaped}" to activate`) !== null
  }

  if (process.platform === 'win32') {
    try {
      const safeName = appName.replace(/'/g, "''")
      execSync(
        `powershell -NoProfile -Command "$p = Get-Process -Name '${safeName}' -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p) { Add-Type @' using System; using System.Runtime.InteropServices; public class W { [DllImport(\\\"user32.dll\\\")] public static extern bool SetForegroundWindow(System.IntPtr h); } '@; [W]::SetForegroundWindow($p.MainWindowHandle) }"`,
        { timeout: 3000 },
      )
      return true
    } catch {
      return false
    }
  }

  return false
}

function readFocusedFieldValue(appName?: string): string | null {
  if (appName) return readFocusedFieldInProcess(appName)
  if (!accessibilityTrusted()) return null

  const script = `
tell application "System Events"
  set frontProc to first application process whose frontmost is true
  try
    tell frontProc
      set focusedEl to value of attribute "AXFocusedUIElement"
      try
        set focusedValue to value of focusedEl
        if focusedValue is not missing value then
          return focusedValue as text
        end if
      end try
    end tell
  end try
  return ""
end tell
`

  const value = runOsascript(script, 4000)
  if (!value) return null
  return value.trim() || null
}

function setFocusedFieldValue(nextValue: string, appName?: string): boolean {
  if (appName) return setFocusedFieldInProcess(appName, nextValue)
  if (!accessibilityTrusted()) return false

  const payload = nextValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const script = `
tell application "System Events"
  set frontProc to first application process whose frontmost is true
  try
    tell frontProc
      set focusedEl to value of attribute "AXFocusedUIElement"
      set value of focusedEl to "${payload}"
      return "ok"
    end tell
  end try
  return "fail"
end tell
`

  return runOsascript(script, 4000) === 'ok'
}

function pasteAtFrontmost(): boolean {
  if (process.platform === 'darwin') {
    if (!accessibilityTrusted()) return false
    return (
      runOsascript(
        `tell application "System Events" to keystroke "v" using command down`,
        3000,
      ) !== null
    )
  }

  if (process.platform === 'win32') {
    try {
      execSync(
        `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`,
        { timeout: 3000 },
      )
      return true
    } catch {
      return false
    }
  }

  return false
}

function clickAtScreenPoint(x: number, y: number): boolean {
  if (process.platform === 'darwin') {
    if (!accessibilityTrusted()) return false
    const script = `
tell application "System Events"
  click at {${Math.round(x)}, ${Math.round(y)}}
end tell
`
    return runOsascript(script, 2000) !== null
  }

  if (process.platform === 'win32') {
    try {
      execSync(
        `powershell -NoProfile -Command "Add-Type @' using System; using System.Runtime.InteropServices; public class M { [DllImport(\\\"user32.dll\\\")] public static extern bool SetCursorPos(int x, int y); [DllImport(\\\"user32.dll\\\")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, int i); } '@; [M]::SetCursorPos(${Math.round(x)},${Math.round(y)})|Out-Null; [M]::mouse_event(0x0002,0,0,0,0); [M]::mouse_event(0x0004,0,0,0,0)"`,
        { timeout: 2000 },
      )
      return true
    } catch {
      return false
    }
  }

  return false
}

function mergeDictationText(
  existing: string | null,
  trimmed: string,
  surface: DictationSurface,
): string {
  if (!existing || existing.length === 0) return trimmed
  const prior = existing.replace(/\s+$/, '')
  if (surface === 'email') {
    return `${prior}\n\n${trimmed}`
  }
  if (surface === 'chat' || surface === 'code') {
    return `${prior} ${trimmed}`
  }
  return `${prior} ${trimmed}`
}

async function focusFieldAtCursor(app: string): Promise<{ x: number; y: number } | null> {
  const cursor = screen.getCursorScreenPoint()
  activateApplication(app)
  await delay(120)
  clickAtScreenPoint(cursor.x, cursor.y)
  await delay(100)
  return cursor
}

async function pasteViaClipboard(text: string): Promise<boolean> {
  const previousClipboard = clipboard.readText()
  clipboard.writeText(text)
  await delay(40)

  const pasted = pasteAtFrontmost()
  if (!pasted) {
    if (previousClipboard) {
      clipboard.writeText(previousClipboard)
    } else {
      clipboard.clear()
    }
    return false
  }

  await delay(180)
  if (previousClipboard) {
    clipboard.writeText(previousClipboard)
  } else {
    clipboard.clear()
  }
  return true
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type DictationInsertResult = {
  ok: boolean
  method?: 'accessibility' | 'paste'
  error?: 'accessibility_required' | 'no_target_app' | 'insert_failed'
  targetApp?: string | null
  clipboardFallback?: boolean
}

function resolveInsertTarget(
  target?: string | null | DictationTargetSnapshot,
): { app: string | null; snapshot: DictationTargetSnapshot | null } {
  if (target && typeof target === 'object' && typeof target.app === 'string') {
    return { app: target.app, snapshot: target }
  }
  const app = typeof target === 'string' ? target.trim() || getDictationTargetApp() : getDictationTargetApp()
  return { app, snapshot: null }
}

export async function insertTextIntoExternalField(
  text: string,
  target?: string | null | DictationTargetSnapshot,
): Promise<DictationInsertResult> {
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, error: 'insert_failed' }

  const { app, snapshot } = resolveInsertTarget(target)
  if (!app || isClarifiProcess(app)) {
    return { ok: false, error: 'no_target_app', targetApp: app }
  }

  if (process.platform === 'darwin') {
    if (!accessibilityTrusted()) {
      return { ok: false, error: 'accessibility_required' }
    }

    const surface = inferDictationSurface(app)
    await focusFieldAtCursor(app)

    if (await pasteViaClipboard(trimmed)) {
      return { ok: true, method: 'paste', targetApp: app }
    }

    const existing = readFocusedFieldInProcess(app) ?? snapshot?.fieldPreview ?? null
    const merged = mergeDictationText(existing, trimmed, surface)

    if (setFocusedFieldInProcess(app, merged)) {
      return { ok: true, method: 'accessibility', targetApp: app }
    }

    return { ok: false, error: 'insert_failed', targetApp: app }
  }

  if (process.platform === 'win32') {
    await focusFieldAtCursor(app)
    if (await pasteViaClipboard(trimmed)) {
      return { ok: true, method: 'paste', targetApp: app }
    }
    clipboard.writeText(trimmed)
    return { ok: false, error: 'insert_failed', targetApp: app, clipboardFallback: true }
  }

  clipboard.writeText(trimmed)
  return { ok: false, error: 'insert_failed', targetApp: app, clipboardFallback: true }
}

export async function replaceSelectionInExternalField(
  text: string,
  selectedText: string,
  target?: string | null | DictationTargetSnapshot,
): Promise<DictationInsertResult> {
  const trimmed = text.trim()
  const prior = selectedText.trim()
  if (!trimmed || !prior) return { ok: false, error: 'insert_failed' }

  const { app } = resolveInsertTarget(target)
  if (!app || isClarifiProcess(app)) {
    return { ok: false, error: 'no_target_app', targetApp: app }
  }

  if (process.platform === 'darwin') {
    if (!accessibilityTrusted()) {
      return { ok: false, error: 'accessibility_required' }
    }

    await focusFieldAtCursor(app)

    const existing = readFocusedFieldInProcess(app)
    if (existing && existing.includes(prior)) {
      const nextValue = existing.replace(prior, trimmed)
      if (setFocusedFieldInProcess(app, nextValue)) {
        return { ok: true, method: 'accessibility', targetApp: app }
      }
    }

    if (await pasteViaClipboard(trimmed)) {
      return { ok: true, method: 'paste', targetApp: app }
    }

    clipboard.writeText(trimmed)
    return { ok: false, error: 'insert_failed', targetApp: app, clipboardFallback: true }
  }

  if (process.platform === 'win32') {
    await focusFieldAtCursor(app)
    if (await pasteViaClipboard(trimmed)) {
      return { ok: true, method: 'paste', targetApp: app }
    }
    clipboard.writeText(trimmed)
    return { ok: false, error: 'insert_failed', targetApp: app, clipboardFallback: true }
  }

  clipboard.writeText(trimmed)
  return { ok: false, error: 'insert_failed', targetApp: app, clipboardFallback: true }
}
