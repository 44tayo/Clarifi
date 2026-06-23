import { execSync } from 'child_process'
import { clipboard, screen, systemPreferences } from 'electron'
import { runOsascript, runOsascriptAsync } from './osascript'
import { getFrontmostAppNameCached } from './proactive/textExtraction'

let lastExternalFrontmostApp: string | null = null
let lastExternalDisplayId: number | null = null
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
  const id = screen.getDisplayNearestPoint(center).id
  lastExternalDisplayId = id
  return id
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
 * Fast display lookup for pill/overlay positioning — never blocks on AppleScript.
 * Background refresh keeps lastExternalDisplayId up to date.
 */
export function getFollowDisplayId(): number {
  if (lastExternalDisplayId !== null) {
    return lastExternalDisplayId
  }
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id
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

/** Snapshot target app + display at session start — frozen for insert. */
export function captureDictationTarget(): DictationTargetSnapshot | null {
  trackExternalFrontmostApp(true)
  const app = getDictationTargetApp()
  if (!app || isClarifiProcess(app)) return null

  const fieldPreview = readFocusedFieldValue()?.slice(0, 80)
  const windowTitle = readFrontWindowTitle()
  const displayId = getFrontmostAppDisplayId()

  return {
    app,
    displayId,
    windowTitle,
    fieldPreview: fieldPreview || undefined,
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
    const center = getFrontmostWindowCenterSync()
    if (center) {
      lastExternalDisplayId = screen.getDisplayNearestPoint(center).id
    }
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

function readFocusedFieldValue(): string | null {
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

function setFocusedFieldValue(nextValue: string): boolean {
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

const PASTE_FIRST_APPS = ['cursor', 'visual studio code', 'code', 'sublime', 'webstorm', 'intellij', 'zed']

function prefersPasteInsert(appName: string): boolean {
  const lower = appName.toLowerCase()
  return PASTE_FIRST_APPS.some((name) => lower.includes(name))
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

export async function insertTextIntoExternalField(
  text: string,
  targetApp?: string | null,
): Promise<DictationInsertResult> {
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, error: 'insert_failed' }

  const app = targetApp?.trim() || getDictationTargetApp()
  if (!app || isClarifiProcess(app)) {
    return { ok: false, error: 'no_target_app', targetApp: app }
  }

  if (process.platform === 'darwin') {
    if (!accessibilityTrusted()) {
      return { ok: false, error: 'accessibility_required' }
    }

    activateApplication(app)
    await delay(100)

    if (prefersPasteInsert(app)) {
      if (await pasteViaClipboard(trimmed)) {
        return { ok: true, method: 'paste', targetApp: app }
      }
    }

    const existing = readFocusedFieldValue()
    const merged =
      existing && existing.length > 0
        ? `${existing.replace(/\s+$/, '')}\n\n${trimmed}`
        : trimmed

    if (setFocusedFieldValue(merged)) {
      return { ok: true, method: 'accessibility', targetApp: app }
    }

    if (await pasteViaClipboard(trimmed)) {
      return { ok: true, method: 'paste', targetApp: app }
    }

    return { ok: false, error: 'insert_failed', targetApp: app }
  }

  if (process.platform === 'win32') {
    activateApplication(app)
    await delay(100)
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
  targetApp?: string | null,
): Promise<DictationInsertResult> {
  const trimmed = text.trim()
  const prior = selectedText.trim()
  if (!trimmed || !prior) return { ok: false, error: 'insert_failed' }

  const app = targetApp?.trim() || getDictationTargetApp()
  if (!app || isClarifiProcess(app)) {
    return { ok: false, error: 'no_target_app', targetApp: app }
  }

  if (process.platform === 'darwin') {
    if (!accessibilityTrusted()) {
      return { ok: false, error: 'accessibility_required' }
    }

    activateApplication(app)
    await delay(180)

    const existing = readFocusedFieldValue()
    if (existing && existing.includes(prior)) {
      const nextValue = existing.replace(prior, trimmed)
      if (setFocusedFieldValue(nextValue)) {
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
    activateApplication(app)
    await delay(180)
    if (await pasteViaClipboard(trimmed)) {
      return { ok: true, method: 'paste', targetApp: app }
    }
    clipboard.writeText(trimmed)
    return { ok: false, error: 'insert_failed', targetApp: app, clipboardFallback: true }
  }

  clipboard.writeText(trimmed)
  return { ok: false, error: 'insert_failed', targetApp: app, clipboardFallback: true }
}
