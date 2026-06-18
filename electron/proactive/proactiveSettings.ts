import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type { ProactiveSettings } from './types'

const SETTINGS_FILE = 'proactive-settings.json'

export const DEFAULT_PROACTIVE_SETTINGS: ProactiveSettings = {
  enabled: false,
  analysisIntervalMs: 10_000,
  suggestionAutoDismissMs: 60_000,
  maxVisibleSuggestions: 3,
  captureMode: 'full_screen',
  appWhitelist: [],
  appBlacklist: [],
  clipboardPollMs: 500,
  features: {
    screenWatch: true,
    writingAssistant: true,
    autoSummarise: true,
    actionItems: true,
    draftGenerator: true,
  },
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), SETTINGS_FILE)
}

export function loadProactiveSettings(): ProactiveSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<ProactiveSettings>
    return {
      ...DEFAULT_PROACTIVE_SETTINGS,
      ...parsed,
      features: { ...DEFAULT_PROACTIVE_SETTINGS.features, ...parsed.features },
    }
  } catch {
    return { ...DEFAULT_PROACTIVE_SETTINGS }
  }
}

export function saveProactiveSettings(settings: ProactiveSettings): ProactiveSettings {
  const merged: ProactiveSettings = {
    ...DEFAULT_PROACTIVE_SETTINGS,
    ...settings,
    features: { ...DEFAULT_PROACTIVE_SETTINGS.features, ...settings.features },
  }
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.writeFileSync(settingsPath(), JSON.stringify(merged, null, 2))
  return merged
}
