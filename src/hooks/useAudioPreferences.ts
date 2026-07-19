import { useCallback, useEffect, useState } from 'react'

export type AudioPreferences = {
  transcriptionLanguage: string
  outputLanguage: string
  dictationLanguage: string
  dictationOutputLanguage: string
  dictationEnabled: boolean
  uiSoundsEnabled: boolean
  preferredMicrophoneId: string
  preferredMicrophoneLabel: string
  systemAudioCapture: 'meeting' | 'display'
  transcriptionMode: 'dual' | 'group'
}

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
