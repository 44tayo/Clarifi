import { BrowserWindow } from 'electron'
import { captureScreenForContext } from '../screenCapture'
import { analysisFingerprint, hasMeaningfulContextChange } from './contextDiff'
import {
  loadProactiveSettings,
  saveProactiveSettings,
} from './proactiveSettings'
import { restartClipboardMonitor, stopClipboardMonitor, startClipboardMonitor } from './clipboardMonitor'
import { analyzeScreenCapture } from './screenAnalyzer'
import {
  getFrontmostAppName,
  shouldWatchApp,
} from './textExtraction'
import type {
  ProactiveEngineState,
  ProactiveSettings,
  ProactiveSuggestionsPayload,
  ProactiveScreenAnalysis,
} from './types'

let settings: ProactiveSettings = loadProactiveSettings()
let loopTimer: NodeJS.Timeout | null = null
let dismissTimer: NodeJS.Timeout | null = null
let analyzing = false
let lastFingerprint: string | null = null

let state: ProactiveEngineState = {
  running: false,
  enabled: settings.enabled,
  lastAnalysisAt: null,
  lastError: null,
  analysis: null,
  fingerprint: null,
  suggestionsVisibleUntil: null,
}

let currentPayload: ProactiveSuggestionsPayload | null = null

function broadcastSuggestions(payload: ProactiveSuggestionsPayload | null): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('proactive:suggestions-update', payload)
    }
  }
}

function scheduleDismiss(expiresAt: number): void {
  if (dismissTimer) clearTimeout(dismissTimer)
  const delay = Math.max(0, expiresAt - Date.now())
  dismissTimer = setTimeout(() => {
    currentPayload = null
    state.suggestionsVisibleUntil = null
    broadcastSuggestions(null)
  }, delay)
}

function rankActions(analysis: ProactiveScreenAnalysis): ProactiveScreenAnalysis {
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  const sorted = [...analysis.suggested_actions].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
  )
  return {
    ...analysis,
    suggested_actions: sorted.slice(0, settings.maxVisibleSuggestions),
  }
}

async function logAnalysisToMemory(
  analysis: ProactiveScreenAnalysis,
  fingerprint: string,
): Promise<void> {
  try {
    const { MemoryService } = await import('../memory/MemoryService')
    const sessionId = 'proactive-screen-watch'
    const existing = MemoryService.getSessionSync(sessionId)
    if (!existing) {
      MemoryService.upsertSessionSync({
        id: sessionId,
        type: 'chat',
        title: 'Proactive screen watch',
        startedAt: Date.now(),
        status: 'active',
        metadata: { source: 'proactive-engine' },
      })
    }
    MemoryService.replaceInteractionsSync(sessionId, [
      {
        type: 'proactive_analysis',
        role: 'system',
        content: JSON.stringify({ fingerprint, analysis }),
        metadata: { context_type: analysis.context_type },
        createdAt: Date.now(),
      },
    ])
  } catch (err) {
    console.error('[proactive] memory log failed:', err)
  }
}

async function runAnalysisTick(): Promise<void> {
  if (!settings.enabled || analyzing) return

  analyzing = true
  state.lastError = null

  try {
    const frontmostApp = getFrontmostAppName()
    if (!shouldWatchApp(frontmostApp, settings.appWhitelist, settings.appBlacklist)) {
      return
    }

    if (!settings.features.screenWatch) {
      return
    }

    const capture = await captureScreenForContext()
    if ('error' in capture) {
      state.lastError = capture.error
      return
    }

    const rawAnalysis = await analyzeScreenCapture(capture.imageBase64, capture.mimeType)
    if (!rawAnalysis) {
      state.lastError = 'analysis_failed'
      return
    }

    const analysis = rankActions(rawAnalysis)
    const fingerprint = analysisFingerprint(analysis)
    state.lastAnalysisAt = Date.now()
    state.analysis = analysis
    state.fingerprint = fingerprint

    if (!hasMeaningfulContextChange(lastFingerprint, analysis)) {
      return
    }

    lastFingerprint = fingerprint

    if (analysis.suggested_actions.length === 0) {
      currentPayload = null
      state.suggestionsVisibleUntil = null
      broadcastSuggestions(null)
      void logAnalysisToMemory(analysis, fingerprint)
      return
    }

    const capturedAt = Date.now()
    const expiresAt = capturedAt + settings.suggestionAutoDismissMs
    currentPayload = { analysis, fingerprint, capturedAt, expiresAt }
    state.suggestionsVisibleUntil = expiresAt

    broadcastSuggestions(currentPayload)
    scheduleDismiss(expiresAt)
    void logAnalysisToMemory(analysis, fingerprint)

    console.log(
      `[proactive] context=${analysis.context_type} actions=${analysis.suggested_actions.length}`,
    )
  } catch (err) {
    console.error('[proactive] tick failed:', err)
    state.lastError = 'tick_failed'
  } finally {
    analyzing = false
  }
}

function scheduleLoop(): void {
  if (loopTimer) clearInterval(loopTimer)
  if (!settings.enabled) return

  loopTimer = setInterval(() => {
    void runAnalysisTick()
  }, settings.analysisIntervalMs)

  // First tick shortly after start
  setTimeout(() => void runAnalysisTick(), 1500)
}

export function getProactiveEngineState(): ProactiveEngineState {
  return { ...state, enabled: settings.enabled, running: loopTimer != null }
}

export function getProactiveSettings(): ProactiveSettings {
  return { ...settings }
}

export function getCurrentProactiveSuggestions(): ProactiveSuggestionsPayload | null {
  if (!currentPayload) return null
  if (currentPayload.expiresAt <= Date.now()) return null
  return currentPayload
}

export function updateProactiveSettings(
  patch: Partial<ProactiveSettings>,
): ProactiveSettings {
  settings = saveProactiveSettings({ ...settings, ...patch })
  state.enabled = settings.enabled

  if (settings.enabled) {
    startProactiveEngine()
  } else {
    stopProactiveEngine()
  }

  restartClipboardMonitor()

  return { ...settings }
}

export function startProactiveEngine(): void {
  if (!settings.enabled) return
  if (loopTimer) return

  settings.enabled = true
  state.running = true
  state.enabled = true
  scheduleLoop()
  startClipboardMonitor()
  console.log('[proactive] engine started', { intervalMs: settings.analysisIntervalMs })
}

export function stopProactiveEngine(): void {
  if (loopTimer) {
    clearInterval(loopTimer)
    loopTimer = null
  }
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
  state.running = false
  stopClipboardMonitor()
  console.log('[proactive] engine stopped')
}

export function dismissProactiveSuggestions(): void {
  currentPayload = null
  state.suggestionsVisibleUntil = null
  if (dismissTimer) clearTimeout(dismissTimer)
  broadcastSuggestions(null)
}

export function initializeProactiveEngine(): void {
  settings = loadProactiveSettings()
  state.enabled = settings.enabled
  if (settings.enabled) {
    startProactiveEngine()
  }
}
