import { execSync } from 'child_process'
import { clipboard, systemPreferences } from 'electron'

import { getDictationTargetApp, isClarifiProcess } from './dictationInsert'
import { runOsascript } from './osascript'
import { getFrontmostAppName } from './proactive/textExtraction'

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
        `powershell -NoProfile -Command "(Get-Process -Name '${safeName}' -ErrorAction SilentlyContinue | Select-Object -First 1).MainWindowHandle"`,
        { timeout: 3000 },
      )
      return true
    } catch {
      return false
    }
  }

  return false
}

function simulateCopyShortcut(): boolean {
  if (process.platform === 'darwin') {
    if (!accessibilityTrusted()) return false
    return (
      runOsascript(
        `tell application "System Events" to keystroke "c" using command down`,
        2500,
      ) !== null
    )
  }

  if (process.platform === 'win32') {
    try {
      execSync(
        `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^c')"`,
        { timeout: 2500 },
      )
      return true
    } catch {
      return false
    }
  }

  return false
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type CaptureSelectionResult = {
  text?: string
  error?: 'no_selection' | 'accessibility_required' | 'no_target_app' | 'capture_failed'
  targetApp?: string | null
}

/** Copy the user's highlighted text from the target app via clipboard swap. */
export async function captureSelectedTextFromTargetApp(
  targetApp?: string | null,
): Promise<CaptureSelectionResult> {
  if (process.platform === 'darwin' && !accessibilityTrusted()) {
    return { error: 'accessibility_required' }
  }

  const app = targetApp?.trim() || getDictationTargetApp()
  if (!app || isClarifiProcess(app)) {
    return { error: 'no_target_app', targetApp: app }
  }

  const previousClipboard = clipboard.readText()
  activateApplication(app)
  await delay(120)

  const copied = simulateCopyShortcut()
  if (!copied) {
    if (previousClipboard) clipboard.writeText(previousClipboard)
    return { error: 'capture_failed', targetApp: app }
  }

  await delay(150)
  const selected = clipboard.readText()?.trim() ?? ''
  if (previousClipboard) {
    clipboard.writeText(previousClipboard)
  } else {
    clipboard.clear()
  }

  if (!selected || selected === previousClipboard?.trim()) {
    return { error: 'no_selection', targetApp: app }
  }

  return { text: selected, targetApp: app }
}

export function peekTargetAppForSelection(): string | null {
  const current = getFrontmostAppName()
  if (current && !isClarifiProcess(current)) return current
  return getDictationTargetApp()
}
