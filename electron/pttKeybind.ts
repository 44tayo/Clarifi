import { loadKeybindPreferences, normalizeAccelerator } from './keybindPreferences'

export type PttKeySpec = {
  /** Platform key code: 0 = Fn mode on macOS, VK on Windows. */
  vkOrKeyCode: number
}

const WIN_VK_BY_KEY: Record<string, number> = {
  Space: 0x20,
  Enter: 0x0d,
  Tab: 0x09,
  Escape: 0x1b,
  Backspace: 0x08,
  Delete: 0x2e,
  Home: 0x24,
  End: 0x23,
  PageUp: 0x21,
  PageDown: 0x22,
  Up: 0x26,
  Down: 0x28,
  Left: 0x25,
  Right: 0x27,
  F1: 0x70,
  F2: 0x71,
  F3: 0x72,
  F4: 0x73,
  F5: 0x74,
  F6: 0x75,
  F7: 0x76,
  F8: 0x77,
  F9: 0x78,
  F10: 0x79,
  F11: 0x7a,
  F12: 0x7b,
}

const MAC_KEYCODE_BY_KEY: Record<string, number> = {
  Space: 49,
  Enter: 36,
  Return: 36,
  Tab: 48,
  Escape: 53,
  Backspace: 51,
  Delete: 117,
  Up: 126,
  Down: 125,
  Left: 123,
  Right: 124,
  F1: 122,
  F2: 120,
  F3: 99,
  F4: 118,
  F5: 96,
  F6: 97,
  F7: 98,
  F8: 100,
  F9: 101,
  F10: 109,
  F11: 103,
  F12: 111,
  A: 0,
  B: 11,
  C: 8,
  D: 2,
  E: 14,
  F: 3,
  G: 5,
  H: 4,
  I: 34,
  J: 38,
  K: 40,
  L: 37,
  M: 46,
  N: 45,
  O: 31,
  P: 35,
  Q: 12,
  R: 15,
  S: 1,
  T: 17,
  U: 32,
  V: 9,
  W: 13,
  X: 7,
  Y: 16,
  Z: 6,
}

function letterVk(letter: string): number | undefined {
  const code = letter.toUpperCase().charCodeAt(0)
  if (code >= 65 && code <= 90) return code
  return undefined
}

function letterMacKeycode(letter: string): number | undefined {
  return MAC_KEYCODE_BY_KEY[letter.toUpperCase()]
}

function resolveWindowsVk(accel: string, parts: string[]): number {
  if (accel === 'CommandOrControl+Right' || accel === 'Control+Right') {
    return 0xa3
  }
  if (accel === 'CommandOrControl+Left' || accel === 'Control+Left') {
    return 0xa2
  }
  if (accel === 'Alt+Right' || accel === 'Alt+Left') {
    return accel.endsWith('Right') ? 0xa5 : 0xa4
  }
  if (accel === 'Shift+Right' || accel === 'Shift+Left') {
    return accel.endsWith('Right') ? 0xa1 : 0xa0
  }

  const key = parts[parts.length - 1] ?? ''
  if (WIN_VK_BY_KEY[key]) return WIN_VK_BY_KEY[key]
  const letter = letterVk(key)
  if (letter) return letter
  return 0xa3
}

function resolveMacKeyCode(accel: string, parts: string[]): number {
  if (parts.length === 1 && parts[0] === 'Fn') return 0

  if (accel === 'CommandOrControl+Right' || accel === 'Control+Right') {
    return 62
  }
  if (accel === 'CommandOrControl+Left' || accel === 'Control+Left') {
    return 59
  }
  if (accel === 'Alt+Right' || accel === 'Alt+Left') {
    return accel.endsWith('Right') ? 61 : 58
  }
  if (accel === 'Shift+Right' || accel === 'Shift+Left') {
    return accel.endsWith('Right') ? 60 : 56
  }

  const key = parts[parts.length - 1] ?? ''
  if (MAC_KEYCODE_BY_KEY[key] !== undefined) return MAC_KEYCODE_BY_KEY[key]
  const letter = letterMacKeycode(key)
  if (letter !== undefined) return letter
  return 0
}

export function resolvePttKeyFromPrefs(): PttKeySpec {
  const accel = normalizeAccelerator(loadKeybindPreferences().hold_to_dictate)
  const parts = accel.split('+').filter(Boolean)

  if (parts.length === 1 && parts[0] === 'Fn') {
    return { vkOrKeyCode: 0 }
  }

  const vkOrKeyCode =
    process.platform === 'win32'
      ? resolveWindowsVk(accel, parts)
      : resolveMacKeyCode(accel, parts)

  return { vkOrKeyCode }
}
