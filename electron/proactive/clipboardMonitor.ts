import { resetClipboardBaseline, pollClipboardChange } from './textExtraction'
import { handleClipboardCopy } from './featureHandlers'
import { getProactiveSettings } from './proactiveEngine'

let clipboardTimer: NodeJS.Timeout | null = null

export function startClipboardMonitor(): void {
  if (clipboardTimer) return
  resetClipboardBaseline()

  clipboardTimer = setInterval(() => {
    const settings = getProactiveSettings()
    if (!settings.enabled || !settings.features.writingAssistant) return

    const change = pollClipboardChange()
    if (change) {
      handleClipboardCopy(change.text)
    }
  }, getProactiveSettings().clipboardPollMs)
}

export function stopClipboardMonitor(): void {
  if (clipboardTimer) {
    clearInterval(clipboardTimer)
    clipboardTimer = null
  }
}

export function restartClipboardMonitor(): void {
  stopClipboardMonitor()
  const settings = getProactiveSettings()
  if (settings.enabled) {
    startClipboardMonitor()
  }
}
