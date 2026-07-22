import { BrowserWindow, systemPreferences, shell } from 'electron'

import { getSystemAudioCaptureMode } from './audioPreferences'
import { startSystemAudio, stopSystemAudio } from './systemAudio'

export type PermissionStatus = {
  microphone: 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'
  systemAudio: 'granted' | 'denied' | 'not-determined' | 'unsupported' | 'unknown'
  platform: NodeJS.Platform
}

export function getPermissionStatus(): PermissionStatus {
  const platform = process.platform
  let microphone: PermissionStatus['microphone'] = 'unknown'
  let systemAudio: PermissionStatus['systemAudio'] = 'unsupported'

  if (platform === 'darwin') {
    try {
      const mic = systemPreferences.getMediaAccessStatus('microphone')
      microphone =
        mic === 'granted' || mic === 'denied' || mic === 'not-determined' || mic === 'restricted'
          ? mic
          : 'unknown'
    } catch {
      microphone = 'unknown'
    }

    try {
      // System audio capture on macOS rides on Screen Recording permission.
      const screen = systemPreferences.getMediaAccessStatus('screen')
      systemAudio =
        screen === 'granted' || screen === 'denied' || screen === 'not-determined' || screen === 'restricted'
          ? (screen as PermissionStatus['systemAudio'])
          : 'unknown'
    } catch {
      systemAudio = 'unknown'
    }
  } else if (platform === 'win32') {
    microphone = 'not-determined'
    systemAudio = 'unsupported'
  } else {
    microphone = 'not-determined'
  }

  return { microphone, systemAudio, platform }
}

export async function requestMicrophoneAccess(): Promise<PermissionStatus> {
  if (process.platform === 'darwin') {
    try {
      await systemPreferences.askForMediaAccess('microphone')
    } catch (err) {
      console.error('askForMediaAccess(microphone) failed:', err)
    }
  }
  return getPermissionStatus()
}

export async function openMicrophoneSettings(): Promise<PermissionStatus> {
  if (process.platform === 'darwin') {
    await shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
    )
  }
  return getPermissionStatus()
}

export async function openSystemAudioSettings(): Promise<PermissionStatus> {
  if (process.platform === 'darwin') {
    // Opens macOS Screen Recording privacy pane — required for system audio.
    await shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
    )
  }
  return getPermissionStatus()
}

/** Quick probe: can we start the system-audio helper right now? */
export function probeSystemAudioCapture(): { ok: boolean; reason?: string } {
  if (process.platform !== 'darwin') {
    return { ok: false, reason: 'System audio capture is currently available on macOS only.' }
  }
  let gotData = false
  const ok = startSystemAudio(() => {
    gotData = true
  })
  stopSystemAudio()
  if (!ok) {
    return {
      ok: false,
      reason: 'Could not start system audio. Grant Screen Recording to Clarifi in System Settings.',
    }
  }
  void gotData
  void getSystemAudioCaptureMode
  return { ok: true }
}

export function focusMainWindow(getWindow?: () => BrowserWindow | null): void {
  const win = getWindow?.()
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }
}
