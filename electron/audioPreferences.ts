import { app, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export type SystemAudioCaptureMode = 'meeting' | 'display'

export type TranscriptionMode = 'dual' | 'group'

export type AudioPreferences = {
  transcriptionLanguage: string
  outputLanguage: string
  dictationLanguage: string
  dictationOutputLanguage: string
  dictationEnabled: boolean
  uiSoundsEnabled: boolean
  preferredMicrophoneId: string
  preferredMicrophoneLabel: string
  systemAudioCapture: SystemAudioCaptureMode
  transcriptionMode: TranscriptionMode
}

const PREFS_FILE = 'audio-preferences.json'

const DEFAULTS: AudioPreferences = {
  transcriptionLanguage: 'en',
  outputLanguage: 'en',
  dictationLanguage: 'auto',
  dictationOutputLanguage: 'same',
  dictationEnabled: true,
  uiSoundsEnabled: true,
  preferredMicrophoneId: '',
  preferredMicrophoneLabel: '',
  systemAudioCapture: 'meeting',
  transcriptionMode: 'dual',
}

const OUTPUT_LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  it: 'Italian',
  nl: 'Dutch',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  hi: 'Hindi',
  ar: 'Arabic',
  pl: 'Polish',
  tr: 'Turkish',
  ru: 'Russian',
  sv: 'Swedish',
}

function prefsPath(): string {
  return path.join(app.getPath('userData'), PREFS_FILE)
}

let cached: AudioPreferences | null = null

export function loadAudioPreferences(): AudioPreferences {
  if (cached) return cached
  try {
    const raw = fs.readFileSync(prefsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AudioPreferences>
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
      transcriptionMode: parsed.transcriptionMode === 'dual' ? 'dual' : 'group',
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

export function getTranscriptionMode(): TranscriptionMode {
  return loadAudioPreferences().transcriptionMode
}

export function isGroupCallMode(): boolean {
  return getTranscriptionMode() === 'group'
}

export function isDualCallMode(): boolean {
  return getTranscriptionMode() === 'dual'
}

export function getOutputLanguage(): string {
  return loadAudioPreferences().outputLanguage
}

export function getOutputLanguageInstruction(): string {
  const code = getOutputLanguage()
  const label = OUTPUT_LANGUAGE_LABELS[code] ?? 'English'
  if (code === 'en') return ''
  return `\n\nRespond in ${label}.`
}

export function getDictationOutputLanguageInstruction(spokenLanguage?: string): string {
  const pref = getDictationOutputLanguage()
  if (pref === 'same') {
    if (!spokenLanguage || spokenLanguage === 'auto') return ''
    const label = OUTPUT_LANGUAGE_LABELS[spokenLanguage] ?? spokenLanguage
    return `\n\nWrite the final text in ${label}. Preserve natural phrasing for that language.`
  }
  const label = OUTPUT_LANGUAGE_LABELS[pref] ?? pref
  return `\n\nWrite the final text in ${label}.`
}

export function notifyAudioPrefsChanged(): void {
  const payload = loadAudioPreferences()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('audio:prefs-changed', payload)
    }
  }
}
