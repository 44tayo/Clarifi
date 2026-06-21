import * as fs from 'fs'
import * as path from 'path'

import {
  refreshDictationBlockedFromAudioSession,
  sendDictationSessionCancel,
  sendDictationSessionFinish,
  sendDictationSessionStart,
} from './dictationPill'

type PttModule = {
  startMonitor: (callback: (event: string) => void, vkCode?: number) => boolean
  stopMonitor: () => boolean
}

let monitorActive = false
let pttDown = false
let pttModule: PttModule | null = null

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
    sendDictationSessionStart()
    return
  }

  if (event === 'up') {
    if (!pttDown) return
    pttDown = false
    sendDictationSessionFinish()
  }
}

export function stopDictationPttMonitor(): void {
  monitorActive = false
  pttDown = false
  try {
    pttModule?.stopMonitor()
  } catch (err) {
    console.warn('[dictation-ptt] stopMonitor failed:', err)
  }
}

export function startDictationPttMonitor(): boolean {
  stopDictationPttMonitor()

  const mod = loadPttModule()
  if (!mod) {
    console.warn('[dictation-ptt] Native module unavailable — Fn hold disabled; use bottom pill.')
    return false
  }

  try {
    const vkCode = process.platform === 'win32' ? 0xa3 : undefined
    mod.startMonitor(handlePttEvent, vkCode)
    monitorActive = true
    console.log('[dictation-ptt] Push-to-talk monitor started')
    return true
  } catch (err) {
    console.warn('[dictation-ptt] Failed to start monitor:', err)
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
