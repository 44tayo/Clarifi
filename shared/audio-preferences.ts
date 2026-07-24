export type TranscriptionMode = 'auto' | 'dual' | 'group'

export type ThemePreference = 'light' | 'dark' | 'system'

export type SystemAudioCaptureMode = 'meeting' | 'display'

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
  skipMicPicker: boolean
  theme: ThemePreference
  /** Prompt before calendar events start (does not auto-record). */
  meetingRemindersEnabled: boolean
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
  transcriptionMode: 'auto',
  skipMicPicker: false,
  theme: 'light',
  meetingRemindersEnabled: true,
}
