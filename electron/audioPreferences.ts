import { app, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { languageLabel } from './languages'
import type {
  AudioPreferences,
  MicSttEngine,
  SystemAudioCaptureMode,
  ThemePreference,
} from '../shared/audio-preferences'
import { DEFAULT_AUDIO_PREFERENCES } from '../shared/audio-preferences'
import { applyNativeTheme } from './theme'

export type { AudioPreferences, MicSttEngine, SystemAudioCaptureMode, ThemePreference }

const PREFS_FILE = 'audio-preferences.json'

const DEFAULTS: AudioPreferences = { ...DEFAULT_AUDIO_PREFERENCES }

function parseTheme(value: unknown): ThemePreference {
  if (value === 'dark' || value === 'system' || value === 'light') return value
  return 'light'
}

function parseMicSttEngine(value: unknown): MicSttEngine {
  return value === 'whisper' ? 'whisper' : 'deepgram'
}

function prefsPath(): string {
  return path.join(app.getPath('userData'), PREFS_FILE)
}

let cached: AudioPreferences | null = null

export function loadAudioPreferences(): AudioPreferences {
  if (cached) return cached
  try {
    const raw = fs.readFileSync(prefsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AudioPreferences> & {
      /** Legacy field — ignored; meetings always use multi-speaker diarization. */
      transcriptionMode?: unknown
    }
    cached = {
      transcriptionLanguage:
        typeof parsed.transcriptionLanguage === 'string'
          ? parsed.transcriptionLanguage
          : DEFAULTS.transcriptionLanguage,
      outputLanguage:
        typeof parsed.outputLanguage === 'string'
          ? parsed.outputLanguage
          : DEFAULTS.outputLanguage,
      dictationLanguage:
        typeof parsed.dictationLanguage === 'string'
          ? parsed.dictationLanguage
          : DEFAULTS.dictationLanguage,
      dictationOutputLanguage:
        typeof parsed.dictationOutputLanguage === 'string'
          ? parsed.dictationOutputLanguage
          : DEFAULTS.dictationOutputLanguage,
      dictationEnabled:
        typeof parsed.dictationEnabled === 'boolean'
          ? parsed.dictationEnabled
          : DEFAULTS.dictationEnabled,
      uiSoundsEnabled:
        typeof parsed.uiSoundsEnabled === 'boolean'
          ? parsed.uiSoundsEnabled
          : DEFAULTS.uiSoundsEnabled,
      preferredMicrophoneId:
        typeof parsed.preferredMicrophoneId === 'string'
          ? parsed.preferredMicrophoneId
          : DEFAULTS.preferredMicrophoneId,
      preferredMicrophoneLabel:
        typeof parsed.preferredMicrophoneLabel === 'string'
          ? parsed.preferredMicrophoneLabel
          : DEFAULTS.preferredMicrophoneLabel,
      systemAudioCapture:
        parsed.systemAudioCapture === 'display' ? 'display' : 'meeting',
      skipMicPicker:
        typeof parsed.skipMicPicker === 'boolean'
          ? parsed.skipMicPicker
          : DEFAULTS.skipMicPicker,
      theme: parseTheme(parsed.theme),
      meetingRemindersEnabled:
        typeof parsed.meetingRemindersEnabled === 'boolean'
          ? parsed.meetingRemindersEnabled
          : DEFAULTS.meetingRemindersEnabled,
      micSttEngine: parseMicSttEngine(parsed.micSttEngine),
    }
    return cached
  } catch {
    cached = { ...DEFAULTS }
    return cached
  }
}

export function saveAudioPreferences(prefs: AudioPreferences): void {
  cached = prefs
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(prefsPath(), JSON.stringify(prefs, null, 2))
  } catch (err) {
    console.error('Failed to save audio preferences:', err)
  }
  applyNativeTheme(prefs.theme)
  notifyAudioPrefsChanged()
}

export function getTranscriptionLanguage(): string {
  return loadAudioPreferences().transcriptionLanguage
}

export function getDictationLanguage(): string {
  return loadAudioPreferences().dictationLanguage
}

export function getDictationEnabled(): boolean {
  return loadAudioPreferences().dictationEnabled
}

export function getDictationOutputLanguage(): string {
  return loadAudioPreferences().dictationOutputLanguage
}

export function getSystemAudioCaptureMode(): SystemAudioCaptureMode {
  return loadAudioPreferences().systemAudioCapture
}

export function getMicSttEngine(): MicSttEngine {
  return loadAudioPreferences().micSttEngine
}

/** Meetings always use mic → Me + system → Speaker N (Jamie/Granola-style). */
export function usesDiarization(): boolean {
  return true
}

export function getOutputLanguage(): string {
  return loadAudioPreferences().outputLanguage
}

export function getOutputLanguageInstruction(): string {
  const code = getOutputLanguage()
  if (code === 'en') return ''
  return `\n\nRespond in ${languageLabel(code)}.`
}

export function getDictationOutputLanguageInstruction(spokenLanguage?: string): string {
  const pref = getDictationOutputLanguage()
  if (pref === 'same') {
    if (!spokenLanguage || spokenLanguage === 'auto') return ''
    return `\n\nWrite the final text in ${languageLabel(spokenLanguage)}. Preserve natural phrasing for that language.`
  }
  return `\n\nWrite the final text in ${languageLabel(pref)}.`
}

export function notifyAudioPrefsChanged(): void {
  const payload = loadAudioPreferences()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('audio:prefs-changed', payload)
    }
  }
}
