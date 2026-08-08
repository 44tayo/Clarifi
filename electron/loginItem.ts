import { app } from 'electron'

/**
 * Keep Clarifi available at login (hidden) so meeting detection can surface
 * Take notes even when the main window was never opened this session.
 * Only applies to packaged macOS builds.
 */
export function syncMeetingDetectionLoginItem(enabled: boolean): void {
  if (!app.isPackaged || process.platform !== 'darwin') return
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true,
    })
  } catch (error) {
    console.warn(
      'Failed to update login item:',
      error instanceof Error ? error.message : error,
    )
  }
}

export function shouldStartHidden(): boolean {
  if (process.argv.includes('--hidden')) return true
  if (!app.isPackaged || process.platform !== 'darwin') return false
  try {
    const settings = app.getLoginItemSettings()
    return Boolean(settings.wasOpenedAsHidden)
  } catch {
    return false
  }
}
