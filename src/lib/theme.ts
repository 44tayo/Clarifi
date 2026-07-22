import type { ThemePreference } from '../../shared/audio-preferences'

export const THEME_STORAGE_KEY = 'clarifi.theme'

export const THEME_WINDOW_BG = {
  light: '#f7f8fc',
  dark: '#12141a',
} as const

export function resolveTheme(
  preference: ThemePreference,
  systemDark?: boolean,
): 'light' | 'dark' {
  if (preference === 'light' || preference === 'dark') return preference
  if (typeof systemDark === 'boolean') return systemDark ? 'dark' : 'light'
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export function applyTheme(preference: ThemePreference): 'light' | 'dark' {
  const resolved = resolveTheme(preference)
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolved
    document.documentElement.style.colorScheme = resolved
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // ignore private mode
  }
  return resolved
}

/** Apply cached preference before React mounts to avoid a light flash. */
export function bootstrapTheme(): void {
  let preference: ThemePreference = 'light'
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') preference = raw
  } catch {
    // ignore
  }
  applyTheme(preference)
}
