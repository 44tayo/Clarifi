export type ThemePreference = 'light' | 'dark' | 'system'

export type SystemAudioCaptureMode = 'meeting' | 'display'

export type MicSttEngine = 'whisper' | 'deepgram'

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
  skipMicPicker: boolean
  theme: ThemePreference
  /** Prompt before calendar events start (does not auto-record). */
  meetingRemindersEnabled: boolean
  /** Prompt when another app is on a call (mic in use) — never auto-records. */
  meetingDetectionEnabled: boolean
  /** Bundle IDs muted from call-detection prompts (e.g. com.apple.Safari). */
  meetingDetectionMutedBundleIds: string[]
  /** Mic transcription engine — 'deepgram' (live, low-latency, default) or 'whisper' (legacy fallback, 3s chunks). */
  micSttEngine: MicSttEngine
}

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  transcriptionLanguage: 'auto',
  outputLanguage: 'en',
  dictationLanguage: 'auto',
  dictationOutputLanguage: 'same',
  dictationEnabled: true,
  uiSoundsEnabled: true,
  preferredMicrophoneId: '',
  preferredMicrophoneLabel: '',
  systemAudioCapture: 'meeting',
  skipMicPicker: false,
  theme: 'light',
  meetingRemindersEnabled: true,
  meetingDetectionEnabled: true,
  meetingDetectionMutedBundleIds: [],
  micSttEngine: 'deepgram',
}
