import { app, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export type KeybindActionId =
  | 'toggle_overlay'
  | 'submit'
  | 'new_chat'
  | 'move_up'
  | 'move_down'
  | 'move_left'
  | 'move_right'
  | 'toggle_recording'
  | 'toggle_history'
  | 'open_settings'
  | 'hold_to_dictate'

export type KeybindDefinition = {
  id: KeybindActionId
  label: string
  description: string
  defaultAccelerator: string
}

export type KeybindPreferences = Record<KeybindActionId, string>

const PREFS_FILE = 'keybind-preferences.json'

export const KEYBIND_DEFINITIONS: KeybindDefinition[] = [
  {
    id: 'toggle_overlay',
    label: 'Show / hide overlay',
    description: 'Toggle the Clarifi overlay on screen.',
    defaultAccelerator: 'CommandOrControl+F',
  },
  {
    id: 'submit',
    label: 'Ask or submit',
    description: 'Submit your question or focus the input field.',
    defaultAccelerator: 'Enter',
  },
  {
    id: 'new_chat',
    label: 'New chat',
    description: 'Start a fresh conversation.',
    defaultAccelerator: 'CommandOrControl+R',
  },
  {
    id: 'move_up',
    label: 'Move overlay up',
    description: 'Nudge the overlay upward.',
    defaultAccelerator: 'CommandOrControl+Up',
  },
  {
    id: 'move_down',
    label: 'Move overlay down',
    description: 'Nudge the overlay downward.',
    defaultAccelerator: 'CommandOrControl+Down',
  },
  {
    id: 'move_left',
    label: 'Move overlay left',
    description: 'Nudge the overlay left.',
    defaultAccelerator: 'CommandOrControl+Left',
  },
  {
    id: 'move_right',
    label: 'Move overlay right',
    description: 'Nudge the overlay right.',
    defaultAccelerator: 'CommandOrControl+Right',
  },
  {
    id: 'toggle_recording',
    label: 'Start / stop listening',
    description: 'Toggle live transcription.',
    defaultAccelerator: 'CommandOrControl+Shift+R',
  },
  {
    id: 'toggle_history',
    label: 'Toggle history',
    description: 'Open or close the history panel.',
    defaultAccelerator: 'CommandOrControl+Shift+H',
  },
  {
    id: 'open_settings',
    label: 'Open settings',
    description: 'Open Clarifi settings.',
    defaultAccelerator: 'CommandOrControl+,',
  },
  {
    id: 'hold_to_dictate',
    label: 'Hold to dictate',
    description:
      process.platform === 'darwin'
        ? 'Hold Fn (Globe) to dictate. Falls back to the shortcut below if Fn is unavailable.'
        : 'Hold Right Ctrl to dictate. Customize the fallback shortcut below.',
    defaultAccelerator: process.platform === 'darwin' ? 'Fn' : 'Control+Right',
  },
]

function defaultPreferences(): KeybindPreferences {
  return Object.fromEntries(
    KEYBIND_DEFINITIONS.map((def) => [def.id, def.defaultAccelerator]),
  ) as KeybindPreferences
}

function prefsPath(): string {
  return path.join(app.getPath('userData'), PREFS_FILE)
}

let cached: KeybindPreferences | null = null

export function loadKeybindPreferences(): KeybindPreferences {
  if (cached) return cached
  const defaults = defaultPreferences()
  try {
    const raw = fs.readFileSync(prefsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<KeybindPreferences>
    cached = { ...defaults }
    for (const def of KEYBIND_DEFINITIONS) {
      const value = parsed[def.id]
      if (typeof value === 'string' && value.trim()) {
        cached[def.id] = normalizeAccelerator(value)
      }
    }
    if (cached.toggle_overlay === 'CommandOrControl+Shift+Space') {
      cached.toggle_overlay = 'CommandOrControl+F'
    }
    if (cached.submit === 'CommandOrControl+Enter') {
      cached.submit = 'Enter'
    }
    return cached
  } catch {
    cached = defaults
    return cached
  }
}

export function saveKeybindPreferences(prefs: KeybindPreferences): KeybindPreferences {
  const defaults = defaultPreferences()
  const next = { ...defaults }
  for (const def of KEYBIND_DEFINITIONS) {
    const value = prefs[def.id]
    next[def.id] = typeof value === 'string' && value.trim() ? normalizeAccelerator(value) : def.defaultAccelerator
  }
  cached = next
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(prefsPath(), JSON.stringify(next, null, 2))
  } catch (err) {
    console.error('Failed to save keybind preferences:', err)
  }
  notifyKeybindPrefsChanged(next)
  return next
}

export function getKeybindAccelerator(action: KeybindActionId): string {
  return loadKeybindPreferences()[action]
}

export function resetKeybindPreferences(): KeybindPreferences {
  cached = null
  try {
    if (fs.existsSync(prefsPath())) {
      fs.unlinkSync(prefsPath())
    }
  } catch {
    // ignore
  }
  const defaults = loadKeybindPreferences()
  notifyKeybindPrefsChanged(defaults)
  return defaults
}

export function resetKeybind(action: KeybindActionId): KeybindPreferences {
  const prefs = loadKeybindPreferences()
  const def = KEYBIND_DEFINITIONS.find((d) => d.id === action)
  if (def) {
    prefs[action] = def.defaultAccelerator
  }
  return saveKeybindPreferences(prefs)
}

export function validateKeybindAssignment(
  action: KeybindActionId,
  accelerator: string,
  prefs = loadKeybindPreferences(),
): string | null {
  const normalized = normalizeAccelerator(accelerator)
  if (!normalized) return 'Invalid shortcut'
  if (action === 'hold_to_dictate' && normalized.toLowerCase() === 'fn') return null
  if (!normalized.includes('+')) return 'Include at least one modifier key'

  for (const def of KEYBIND_DEFINITIONS) {
    if (def.id === action) continue
    if (prefs[def.id] === normalized) {
      return `Already used by “${def.label}”`
    }
  }
  return null
}

export function normalizeAccelerator(accelerator: string): string {
  return accelerator
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase()
      if (lower === 'cmd' || lower === 'command' || lower === 'meta') return 'CommandOrControl'
      if (lower === 'ctrl' || lower === 'control') return 'CommandOrControl'
      if (lower === 'commandorcontrol') return 'CommandOrControl'
      if (lower === 'option' || lower === 'alt') return 'Alt'
      if (lower === 'shift') return 'Shift'
      if (lower === 'space') return 'Space'
      if (lower === 'enter' || lower === 'return') return 'Enter'
      if (lower === 'up' || lower === 'arrowup') return 'Up'
      if (lower === 'down' || lower === 'arrowdown') return 'Down'
      if (lower === 'left' || lower === 'arrowleft') return 'Left'
      if (lower === 'right' || lower === 'arrowright') return 'Right'
      if (lower === 'right') return 'Right'
      if (lower === 'fn' || lower === 'globe') return 'Fn'
      if (part.length === 1) return part.toUpperCase()
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join('+')
}

export function toPublicKeybindPreferences(): {
  definitions: KeybindDefinition[]
  accelerators: KeybindPreferences
} {
  return {
    definitions: KEYBIND_DEFINITIONS,
    accelerators: loadKeybindPreferences(),
  }
}

export function notifyKeybindPrefsChanged(prefs: KeybindPreferences): void {
  const payload = toPublicKeybindPreferences()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('keybinds:prefs-changed', payload)
    }
  }
  void prefs
}
