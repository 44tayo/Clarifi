import {
  getDictationEnabled,
  loadAudioPreferences,
  saveAudioPreferences,
} from './audioPreferences'
import { hideDictationPillWindow, showDictationPillWindow } from './dictationPill'
import {
  cancelDictationViaPtt,
  startDictationPttMonitor,
  stopDictationPttMonitor,
} from './dictationPtt'

export function applyDictationEnabledSideEffects(enabled: boolean): void {
  if (enabled) {
    showDictationPillWindow()
    startDictationPttMonitor()
    return
  }
  cancelDictationViaPtt()
  hideDictationPillWindow()
  stopDictationPttMonitor()
}

export function applyDictationEnabled(enabled: boolean): void {
  const prefs = { ...loadAudioPreferences(), dictationEnabled: enabled }
  saveAudioPreferences(prefs)
  applyDictationEnabledSideEffects(enabled)
}

export function isDictationEnabled(): boolean {
  return getDictationEnabled()
}
