import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { clearAudioSessions } from './audioSessionHistory'
import { clearChatSessions } from './chatHistory'
import { clearAllMemoryData } from './memory/exportService'
import { createOnboardingWindow } from './onboarding'
import { resetOnboarding } from './onboardingState'
import { destroyOverlayWindow } from './overlay'
import { removeLocalAvatar } from './profileLocal'
import { getSettingsWindow } from './settings'
import { deleteKey } from './store'

const DEVICE_ID_KEY = 'device_id'
const DEVICE_SECRET_KEY = 'device_secret'

export async function logoutDevice(): Promise<void> {
  await deleteKey(DEVICE_ID_KEY)
  await deleteKey(DEVICE_SECRET_KEY)
}

export async function resetOnboardingFlow(): Promise<void> {
  await resetOnboarding()
  destroyOverlayWindow()
  const settings = getSettingsWindow()
  if (settings && !settings.isDestroyed()) {
    settings.close()
  }
  createOnboardingWindow()
}

export async function eraseLocalAccountData(): Promise<void> {
  await logoutDevice()
  await resetOnboarding()
  clearChatSessions()
  clearAudioSessions()
  clearAllMemoryData()
  removeLocalAvatar()

  const userData = app.getPath('userData')
  const filesToRemove = [
    'user-preferences.json',
    'audio-preferences.json',
    'keybind-preferences.json',
    'overlay-settings.json',
    'chat-history.json',
    'audio-sessions-history.json',
  ]

  for (const file of filesToRemove) {
    try {
      const fullPath = path.join(userData, file)
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath)
      }
    } catch {
      // ignore missing files
    }
  }

  destroyOverlayWindow()
  const settings = getSettingsWindow()
  if (settings && !settings.isDestroyed()) {
    settings.close()
  }
  createOnboardingWindow()
}

export function quitApp(): void {
  app.quit()
}
