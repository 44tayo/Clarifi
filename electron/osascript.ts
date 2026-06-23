import { spawn, spawnSync } from 'child_process'

let osaSyncBusy = false

/** Blocking AppleScript — use only for user-initiated dictation insert, not background polls. */
export function runOsascript(script: string, timeoutMs = 5000): string | null {
  if (process.platform !== 'darwin') return null
  if (osaSyncBusy) return null

  osaSyncBusy = true
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
    osaSyncBusy = false
  }
}

/** Non-blocking AppleScript for background display/target refresh. */
export function runOsascriptAsync(script: string, timeoutMs = 5000): Promise<string | null> {
  if (process.platform !== 'darwin') return Promise.resolve(null)

  return new Promise((resolve) => {
    const child = spawn('osascript', ['-e', script], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    child.stdout?.setEncoding('utf-8')
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk
    })

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      resolve(null)
    }, timeoutMs)

    child.on('error', () => {
      clearTimeout(timer)
      resolve(null)
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        resolve(null)
        return
      }
      const out = stdout.trim()
      resolve(out || null)
    })
  })
}
