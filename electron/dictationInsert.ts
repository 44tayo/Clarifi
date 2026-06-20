import { execSync } from 'child_process'
import { clipboard, systemPreferences } from 'electron'
import { getFrontmostAppName } from './proactive/textExtraction'

let lastExternalFrontmostApp: string | null = null
let trackingTimer: ReturnType<typeof setInterval> | null = null

const CLARIFI_APP_NAMES = new Set(['clarifi', 'electron'])

export function isClarifiProcess(appName: string | null | undefined): boolean {
  if (!appName) return false
  const lower = appName.toLowerCase()
  for (const name of CLARIFI_APP_NAMES) {
    if (lower.includes(name)) return true
  }
  return false
}

/** Remember the last app the user was working in (not Clarifi). */
export function trackExternalFrontmostApp(): void {
  if (process.platform !== 'darwin') return
  const app = getFrontmostAppName()
  if (app && !isClarifiProcess(app)) {
    lastExternalFrontmostApp = app
  }
}

/** Poll frontmost app so dictation can target Gmail etc. after the user focuses Clarifi. */
export function startDictationTargetTracking(): void {
  if (process.platform !== 'darwin' || trackingTimer) return
  trackExternalFrontmostApp()
  trackingTimer = setInterval(trackExternalFrontmostApp, 1500)
}

export function getDictationTargetApp(): string | null {
  trackExternalFrontmostApp()
  const current = getFrontmostAppName()
  if (current && !isClarifiProcess(current)) return current
  return lastExternalFrontmostApp
}

function accessibilityTrusted(): boolean {
  return (
    process.platform === 'darwin' &&
    systemPreferences.isTrustedAccessibilityClient(false)
  )
}

function runOsascript(script: string, timeoutMs = 5000): string | null {
  try {
    const result = execSync(`osascript -e ${JSON.stringify(script)}`, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    })
    return result.trim()
  } catch {
    return null
  }
}

function activateApplication(appName: string): boolean {
  if (process.platform !== 'darwin') return false
  const escaped = appName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const result = runOsascript(`tell application "${escaped}" to activate`)
  return result !== null
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
  if (!accessibilityTrusted()) return false
  const result = runOsascript(
    `tell application "System Events" to keystroke "v" using command down`,
    3000,
  )
  return result !== null
}

export type DictationInsertResult = {
  ok: boolean
  method?: 'accessibility' | 'paste'
  error?: 'accessibility_required' | 'no_target_app' | 'insert_failed'
  targetApp?: string | null
}

export function insertTextIntoExternalField(
  text: string,
  targetApp?: string | null,
): DictationInsertResult {
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, error: 'insert_failed' }

  if (process.platform !== 'darwin') {
    return { ok: false, error: 'insert_failed' }
  }

  if (!accessibilityTrusted()) {
    return { ok: false, error: 'accessibility_required' }
  }

  const app = targetApp?.trim() || getDictationTargetApp()
  if (!app || isClarifiProcess(app)) {
    return { ok: false, error: 'no_target_app', targetApp: app }
  }

  activateApplication(app)

  const existing = readFocusedFieldValue()
  const merged =
    existing && existing.length > 0
      ? `${existing.replace(/\s+$/, '')}\n\n${trimmed}`
      : trimmed

  if (setFocusedFieldValue(merged)) {
    return { ok: true, method: 'accessibility', targetApp: app }
  }

  const previousClipboard = clipboard.readText()
  clipboard.writeText(trimmed)
  const pasted = pasteAtFrontmost()
  if (previousClipboard) {
    clipboard.writeText(previousClipboard)
  } else {
    clipboard.clear()
  }

  if (pasted) {
    return { ok: true, method: 'paste', targetApp: app }
  }

  return { ok: false, error: 'insert_failed', targetApp: app }
}
