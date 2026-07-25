import { useCallback, useEffect, useState } from 'react'

import type {
  AudioPreferences,
  MicSttEngine,
  ThemePreference,
} from '../../shared/audio-preferences'

export type { AudioPreferences, MicSttEngine, ThemePreference }

type PrefsPatch = Partial<
  Pick<
    AudioPreferences,
    | 'transcriptionLanguage'
    | 'outputLanguage'
    | 'dictationLanguage'
    | 'dictationOutputLanguage'
    | 'preferredMicrophoneId'
    | 'preferredMicrophoneLabel'
    | 'systemAudioCapture'
    | 'skipMicPicker'
    | 'theme'
    | 'meetingRemindersEnabled'
    | 'micSttEngine'
  >
>

export function useAudioPreferences() {
  const [prefs, setPrefs] = useState<AudioPreferences | null>(null)

  const refresh = useCallback(async () => {
    const result = (await window.electronAPI.invoke('audio:get-preferences')) as AudioPreferences
    setPrefs(result)
  }, [])

  useEffect(() => {
    void refresh()
    const off = window.electronAPI.on('audio:prefs-changed', (payload) => {
      setPrefs(payload as AudioPreferences)
    })
    return off
  }, [refresh])

  const update = useCallback(async (patch: PrefsPatch) => {
    const result = (await window.electronAPI.invoke('audio:set-preferences', patch)) as AudioPreferences
    setPrefs(result)
    return result
  }, [])

  return { prefs, refresh, update }
}
