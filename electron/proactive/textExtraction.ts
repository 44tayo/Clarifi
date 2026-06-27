import { randomUUID } from 'crypto'
import { execSync } from 'child_process'
import { clipboard, systemPreferences } from 'electron'
import { captureScreenForContext } from '../screenCapture'
import { analyzeScreenCapture } from './screenAnalyzer'
import type { ProactiveScreenAnalysis } from './types'

export type ExtractedContext = {
  clipboardText: string | null
  frontmostApp: string | null
  accessibilityText: string | null
  screenAnalysis: ProactiveScreenAnalysis | null
  combinedText: string
}

let lastClipboardSnapshot = ''
let lastClipboardChangeAt = 0

const MAX_ACCESSIBILITY_CHARS = 12_000
const MIN_TEXT_FOR_SKIP_VISION = 180

function accessibilityTrusted(): boolean {
  return (
    process.platform === 'darwin' &&
    systemPreferences.isTrustedAccessibilityClient(false)
  )
}

/** Best-effort macOS Accessibility text via System Events UI scripting. */
export function extractAccessibilityText(): string | null {
  if (process.platform !== 'darwin' || !accessibilityTrusted()) return null

  const script = `
tell application "System Events"
  set frontProc to first application process whose frontmost is true
  set chunks to {}
  try
    tell frontProc
      try
        set focusedEl to value of attribute "AXFocusedUIElement"
        try
          set focusedValue to value of focusedEl
          if focusedValue is not missing value then
            set t to focusedValue as text
            if length of t > 1 then set end of chunks to t
          end if
        end try
      end try
      repeat with w in windows
        try
          repeat with el in entire contents of w
            try
              set elRole to role of el as text
              if elRole is in {"text area", "text field", "static text", "scroll area", "group", "AXTextArea", "AXTextField", "AXStaticText", "AXWebArea"} then
                try
                  set elValue to value of el
                  if elValue is not missing value then
                    set t to elValue as text
                    if length of t > 2 then set end of chunks to t
                  end if
                end try
              end if
            end try
          end repeat
        end try
      end repeat
    end tell
  end try
  set AppleScript's text item delimiters to linefeed
  set combined to chunks as text
  set AppleScript's text item delimiters to ""
  return combined
end tell
`

  try {
    const result = execSync(`osascript -e ${JSON.stringify(script)}`, {
      encoding: 'utf-8',
      timeout: 4000,
      maxBuffer: MAX_ACCESSIBILITY_CHARS + 1024,
    })
    const normalized = dedupeLines(result.trim())
    if (!normalized) return null
    return normalized.slice(0, MAX_ACCESSIBILITY_CHARS)
  } catch {
    return null
  }
}

function dedupeLines(text: string): string {
  const seen = new Set<string>()
  const lines: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.length < 3) continue
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    lines.push(line)
  }
  return lines.join('\n')
}

export function getFrontmostAppName(): string | null {
  return getFrontmostAppNameCached(false)
}

let frontmostCache: { name: string | null; at: number } | null = null
const FRONTMOST_CACHE_MS = 4000

/** Cached frontmost app — skips AppleScript when cache is fresh unless force=true. */
export function getFrontmostAppNameCached(force = false): string | null {
  const now = Date.now()
  if (!force && frontmostCache && now - frontmostCache.at < FRONTMOST_CACHE_MS) {
    return frontmostCache.name
  }

  if (process.platform === 'darwin') {
    try {
      const result = execSync(
        `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`,
        { encoding: 'utf-8', timeout: 1500 },
      )
      const name = result.trim() || null
      frontmostCache = { name, at: now }
      return name
    } catch {
      return frontmostCache?.name ?? null
    }
  }

  if (process.platform === 'win32') {
    try {
      const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class ClarifiWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
}
"@
$hwnd = [ClarifiWin]::GetForegroundWindow()
$pid = [uint32]0
[void][ClarifiWin]::GetWindowThreadProcessId($hwnd, [ref]$pid)
if ($pid -eq 0) { exit 1 }
(Get-Process -Id $pid -ErrorAction SilentlyContinue).ProcessName
`
      const result = execSync(`powershell -NoProfile -Command ${JSON.stringify(script)}`, {
        encoding: 'utf-8',
        timeout: 3000,
      })
      return result.trim() || null
    } catch {
      return null
    }
  }

  return null
}

export type DictationSurface =
  | 'email'
  | 'chat'
  | 'code'
  | 'terminal'
  | 'browser'
  | 'document'
  | 'general'

const EMAIL_APPS = ['mail', 'gmail', 'outlook', 'spark', 'superhuman']
const CHAT_APPS = ['slack', 'teams', 'discord', 'messages', 'telegram', 'whatsapp', 'imessage']
const CODE_APPS = ['code', 'cursor', 'xcode', 'sublime', 'webstorm', 'intellij', 'vim', 'nova']
const TERMINAL_APPS = ['terminal', 'iterm', 'warp', 'alacritty', 'kitty', 'hyper', 'wezterm']
const BROWSER_APPS = ['chrome', 'safari', 'firefox', 'edge', 'arc', 'brave', 'opera', 'vivaldi']
const DOCUMENT_APPS = ['notes', 'notion', 'obsidian', 'bear', 'pages', 'word', 'docs', 'evernote']

export function inferDictationSurface(appName: string | null | undefined): DictationSurface {
  if (!appName) return 'general'
  const lower = appName.toLowerCase()
  if (EMAIL_APPS.some((name) => lower.includes(name))) return 'email'
  if (CHAT_APPS.some((name) => lower.includes(name))) return 'chat'
  if (TERMINAL_APPS.some((name) => lower.includes(name))) return 'terminal'
  if (CODE_APPS.some((name) => lower.includes(name))) return 'code'
  if (BROWSER_APPS.some((name) => lower.includes(name))) return 'browser'
  if (DOCUMENT_APPS.some((name) => lower.includes(name))) return 'document'
  return 'general'
}

export function dictationSurfaceLabel(surface: DictationSurface): string {
  switch (surface) {
    case 'email':
      return 'email'
    case 'chat':
      return 'Slack or chat'
    case 'code':
      return 'code editor'
    case 'terminal':
      return 'terminal'
    case 'browser':
      return 'browser'
    case 'document':
      return 'document'
    default:
      return 'your app'
  }
}

export function readClipboardText(): string | null {
  try {
    const text = clipboard.readText()?.trim()
    return text && text.length > 0 ? text : null
  } catch {
    return null
  }
}

export function pollClipboardChange(): { text: string; changedAt: number } | null {
  const text = readClipboardText()
  if (!text || text === lastClipboardSnapshot) return null
  lastClipboardSnapshot = text
  lastClipboardChangeAt = Date.now()
  return { text, changedAt: lastClipboardChangeAt }
}

export function getRecentClipboardText(maxAgeMs = 30_000): string | null {
  const text = readClipboardText()
  if (!text) return null
  const recentlyCopied =
    lastClipboardChangeAt > 0 && Date.now() - lastClipboardChangeAt <= maxAgeMs
  if (recentlyCopied) return text
  return text.length >= 20 ? text : null
}

export function shouldWatchApp(appName: string | null, whitelist: string[], blacklist: string[]): boolean {
  if (!appName) return true
  const lower = appName.toLowerCase()
  if (blacklist.some((b) => lower.includes(b.toLowerCase()))) return false
  if (whitelist.length === 0) return true
  return whitelist.some((w) => lower.includes(w.toLowerCase()))
}

export async function gatherProactiveContext(options?: {
  includeScreenAnalysis?: boolean
}): Promise<ExtractedContext> {
  const includeScreenAnalysis = options?.includeScreenAnalysis ?? true
  const clipboardText = readClipboardText()
  const frontmostApp = getFrontmostAppName()
  const accessibilityText = extractAccessibilityText()

  const localParts = [
    clipboardText ? `Clipboard:\n${clipboardText}` : '',
    accessibilityText ? `Accessibility:\n${accessibilityText}` : '',
    frontmostApp ? `Frontmost app: ${frontmostApp}` : '',
  ].filter(Boolean)

  const localText = localParts.join('\n\n')
  const hasEnoughLocalText = localText.length >= MIN_TEXT_FOR_SKIP_VISION

  let screenAnalysis: ProactiveScreenAnalysis | null = null
  if (includeScreenAnalysis && !hasEnoughLocalText) {
    const capture = await captureScreenForContext()
    if (!('error' in capture)) {
      screenAnalysis = await analyzeScreenCapture(capture.imageBase64, capture.mimeType)
    }
  }

  const parts = [
    ...localParts,
    screenAnalysis
      ? [
          `Activity: ${screenAnalysis.activity_summary}`,
          `Context: ${screenAnalysis.context_type}`,
          ...screenAnalysis.detected_elements.map((e) => `- ${e}`),
        ].join('\n')
      : '',
  ].filter(Boolean)

  return {
    clipboardText,
    frontmostApp,
    accessibilityText,
    screenAnalysis,
    combinedText: parts.join('\n\n').slice(0, 24_000),
  }
}

export function resetClipboardBaseline(): void {
  lastClipboardSnapshot = readClipboardText() ?? ''
  lastClipboardChangeAt = Date.now()
}

export function createProactiveRequestId(): string {
  return randomUUID()
}
