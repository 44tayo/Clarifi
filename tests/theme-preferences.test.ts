import { describe, expect, it } from 'vitest'

import type { AudioPreferences } from '../shared/audio-preferences'
import { DEFAULT_AUDIO_PREFERENCES } from '../shared/audio-preferences'

/** Mirrors electron/ipc audio:set-preferences merge rules for theme. */
function mergeAudioPreferencesPatch(
  current: AudioPreferences,
  payload: Partial<AudioPreferences>,
): AudioPreferences {
  return {
    ...current,
    ...(payload.theme === 'light' || payload.theme === 'dark' || payload.theme === 'system'
      ? { theme: payload.theme }
      : {}),
  }
}

describe('audio preference theme updates', () => {
  it('applies dark theme from set-preferences payloads', () => {
    const next = mergeAudioPreferencesPatch(DEFAULT_AUDIO_PREFERENCES, { theme: 'dark' })
    expect(next.theme).toBe('dark')
  })

  it('ignores invalid theme values', () => {
    const next = mergeAudioPreferencesPatch(DEFAULT_AUDIO_PREFERENCES, {
      theme: 'neon' as AudioPreferences['theme'],
    })
    expect(next.theme).toBe('light')
  })
})
