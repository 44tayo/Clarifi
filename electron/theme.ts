import { BrowserWindow, nativeTheme } from 'electron'

import type { ThemePreference } from '../shared/audio-preferences'

export const THEME_WINDOW_BG = {
  light: '#fafaf8',
  dark: '#1a1a1a',
} as const

export function resolveAppTheme(
  preference: ThemePreference,
): 'light' | 'dark' {
  if (preference === 'light' || preference === 'dark') return preference
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

/** Keep Electron chrome (window fill + OS dialogs) aligned with Clarifi theme. */
export function applyNativeTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') {
    nativeTheme.themeSource = 'system'
  } else {
    nativeTheme.themeSource = preference
  }

  const resolved = resolveAppTheme(preference)
  const background = THEME_WINDOW_BG[resolved]

  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    // Widget compact mode uses transparent chrome — leave that window alone.
    if (win.getTitle() === 'Clarifi Recording') continue
    win.setBackgroundColor(background)
  }

  return resolved
}
