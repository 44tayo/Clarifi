import * as fs from 'fs'
import * as path from 'path'

import { getDictationEnabled } from './audioPreferences'
import { captureDictationTarget } from './dictationInsert'
import { warmGroqConnection } from './groqHttp'
import {
  maybeShowFnGuidanceOnce,
  restoreFnEmojiPicker,
  suppressFnEmojiPicker,
} from './macFnKey'
import { resolvePttKeyFromPrefs } from './pttKeybind'
import {
  refreshDictationBlockedFromAudioSession,
  sendDictationSessionCancel,
  sendDictationSessionFinish,
  sendDictationSessionStart,
} from './dictationPill'

type PttModule = {
  startMonitor: (callback: (event: string) => void, vkCode?: number) => boolean
  stopMonitor: () => boolean
  typeText?: (text: string) => boolean
}

let monitorActive = false
let pttDown = false
let pttModule: PttModule | null = null
let activeKey: number | null = null

function loadPttModule(): PttModule | null {
  if (pttModule) return pttModule

  const candidates = [
    path.join(process.resourcesPath, 'dictation_ptt.node'),
    path.join(__dirname, '../resources/dictation_ptt.node'),
    path.join(__dirname, 'resources/dictation_ptt.node'),
    path.join(process.cwd(), 'resources/dictation_ptt.node'),
  ]

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      pttModule = require(candidate) as PttModule
      return pttModule
    } catch (err) {
      console.warn('[dictation-ptt] Failed to load native module from', candidate, err)
    }
  }

  return null
}

function handlePttEvent(event: string): void {
  refreshDictationBlockedFromAudioSession()

  if (event === 'down') {
    if (pttDown) return
    pttDown = true
    // Open the Groq TLS connection now so it's warm by the time audio is ready.
    warmGroqConnection()
    const snapshot = captureDictationTarget()
    sendDictationSessionStart(snapshot)
    return
  }

  if (event === 'up') {
    if (!pttDown) return
    pttDown = false
    sendDictationSessionFinish()
  }
}

export function stopDictationPttMonitor(restoreFn = true): void {
  monitorActive = false
  pttDown = false
  activeKey = null
  try {
    pttModule?.stopMonitor()
  } catch (err) {
    console.warn('[dictation-ptt] stopMonitor failed:', err)
  }
  // Only restore the Globe key when we're fully tearing down (quit / disable).
  // Internal restarts keep the suppression in place to avoid thrashing the
  // system preference on every periodic monitor restart.
  if (restoreFn) {
    restoreFnEmojiPicker()
  }
}

export function startDictationPttMonitor(): boolean {
  if (!getDictationEnabled()) {
    stopDictationPttMonitor()
    return false
  }

  // Idempotent: if we're already monitoring the same key, don't tear down and
  // restart (periodic permission re-broadcasts call this often). Avoids churn.
  const { vkOrKeyCode: requestedKey } = resolvePttKeyFromPrefs()
  if (monitorActive && activeKey === requestedKey) {
    return true
  }

  stopDictationPttMonitor(false)

  const mod = loadPttModule()
  if (!mod) {
    console.warn('[dictation-ptt] Native module unavailable — Fn hold disabled; use bottom pill.')
    // Without the native tap we can't swallow the Globe key, so guide the user.
    if (requestedKey === 0) {
      maybeShowFnGuidanceOnce()
    }
    return false
  }

  try {
    mod.startMonitor(handlePttEvent, requestedKey)
    monitorActive = true
    activeKey = requestedKey
    // Fn mode (keycode 0): stop macOS from opening the emoji picker on Globe press.
    if (requestedKey === 0) {
      suppressFnEmojiPicker()
    }
    console.log('[dictation-ptt] Push-to-talk monitor started (key:', requestedKey, ')')
    return true
  } catch (err) {
    console.warn('[dictation-ptt] Failed to start monitor:', err)
    return false
  }
}

/**
 * Type text at the user's caret via synthesized Unicode keyboard events (native
 * CGEventKeyboardSetUnicodeString). Inserts exactly where the cursor is and never
 * touches the clipboard. Returns false if the native module / typeText is missing.
 */
export function typeTextAtCursor(text: string): boolean {
  const mod = loadPttModule()
  if (!mod || typeof mod.typeText !== 'function') return false
  try {
    return mod.typeText(text)
  } catch (err) {
    console.warn('[dictation-ptt] typeText failed:', err)
    return false
  }
}

export function cancelDictationViaPtt(): void {
  if (!pttDown) return
  pttDown = false
  sendDictationSessionCancel()
}

export function isDictationPttActive(): boolean {
  return monitorActive
}
