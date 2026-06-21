import { globalShortcut } from 'electron'
import {
  loadKeybindPreferences,
  type KeybindActionId,
  type KeybindPreferences,
} from './keybindPreferences'
import {
  getOverlayWindow,
  nudgeOverlayWindow,
  showOverlayWindow,
  toggleOverlayVisibility,
} from './overlay'
import { openSettingsWindow } from './settings'

const registered = new Set<string>()

function unregisterAllManaged(): void {
  for (const accelerator of registered) {
    if (globalShortcut.isRegistered(accelerator)) {
      globalShortcut.unregister(accelerator)
    }
  }
  registered.clear()
}

function sendOverlayAction(action: KeybindActionId): void {
  const overlay = getOverlayWindow()
  if (!overlay || overlay.isDestroyed()) return
  if (!overlay.isVisible()) {
    showOverlayWindow({ focus: true, resetPosition: true })
  }
  overlay.webContents.send('keybind:action', { action })
}

function runKeybindAction(action: KeybindActionId): void {
  switch (action) {
    case 'toggle_overlay':
      toggleOverlayVisibility()
      return
    case 'move_up':
      nudgeOverlayWindow(0, -24)
      return
    case 'move_down':
      nudgeOverlayWindow(0, 24)
      return
    case 'move_left':
      nudgeOverlayWindow(-24, 0)
      return
    case 'move_right':
      nudgeOverlayWindow(24, 0)
      return
    case 'open_settings':
      openSettingsWindow('keybinds')
      return
    case 'submit':
    case 'new_chat':
    case 'toggle_recording':
    case 'toggle_history':
      sendOverlayAction(action)
      return
    default:
      return
  }
}

export function registerKeybinds(prefs: KeybindPreferences = loadKeybindPreferences()): void {
  unregisterAllManaged()

  const used = new Map<string, KeybindActionId>()
  for (const [action, accelerator] of Object.entries(prefs) as [KeybindActionId, string][]) {
    if (!accelerator || used.has(accelerator)) continue
    if (action === 'hold_to_dictate') continue
    // Plain keys (e.g. Enter) belong in the renderer form — not globalShortcut.
    if (!accelerator.includes('+')) continue
    used.set(accelerator, action)

    try {
      const ok = globalShortcut.register(accelerator, () => {
        runKeybindAction(action)
      })
      if (ok) {
        registered.add(accelerator)
      } else {
        console.warn(`Failed to register keybind for ${action}: ${accelerator}`)
      }
    } catch (err) {
      console.warn(`Invalid keybind for ${action}:`, err)
    }
  }
}

export function getRegisteredAccelerators(): string[] {
  return [...registered]
}

export function registerTutorialAccelerators(
  accelerators: string[],
  handler: (accelerator: string) => void,
): void {
  unregisterAllManaged()
  for (const accelerator of accelerators) {
    if (!accelerator || registered.has(accelerator)) continue
    try {
      const ok = globalShortcut.register(accelerator, () => handler(accelerator))
      if (ok) registered.add(accelerator)
    } catch {
      // ignore invalid tutorial bindings
    }
  }
}

export function pauseKeybindsForTutorial(): void {
  unregisterAllManaged()
}

export function resumeKeybindsAfterTutorial(): void {
  registerKeybinds()
}
