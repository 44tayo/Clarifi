import { spawnSync } from 'child_process'

let osaBusy = false

/** Run AppleScript without shell/execSync stdin — avoids uncaught EPIPE on early exit. */
export function runOsascript(script: string, timeoutMs = 5000): string | null {
  if (process.platform !== 'darwin') return null
  if (osaBusy) return null

  osaBusy = true
  try {
    const result = spawnSync('osascript', ['-e', script], {
      encoding: 'utf-8',
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (result.error || result.status !== 0) return null
    const out = (result.stdout ?? '').trim()
    return out || null
  } catch {
    return null
  } finally {
    osaBusy = false
  }
}
