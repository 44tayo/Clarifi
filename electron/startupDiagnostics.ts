import { app } from 'electron'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

function logPath(): string {
  return path.join(os.homedir(), 'Library', 'Logs', 'Clarifi', 'startup.log')
}

export function logStartup(
  hypothesisId: string,
  message: string,
  data: Record<string, unknown> = {},
): void {
  const payload = {
    hypothesisId,
    location: 'electron/startupDiagnostics.ts',
    message,
    data: {
      ...data,
      pid: process.pid,
      packaged: app.isPackaged,
      execPath: process.execPath,
    },
    timestamp: Date.now(),
  }
  const line = `${JSON.stringify(payload)}\n`
  try {
    const file = logPath()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.appendFileSync(file, line)
  } catch {
    /* ignore */
  }
}

export function stripMacQuarantine(): void {
  // Only for explicitly unsigned local installs. Notarized Gatekeeper builds
  // must not strip quarantine — that hides signing problems.
  if (process.env.CLARIFI_STRIP_QUARANTINE !== '1') return
  if (process.platform !== 'darwin' || !app.isPackaged) return

  const appBundle = path.resolve(process.execPath, '..', '..', '..')
  const targets = [process.execPath, appBundle]
  for (const target of targets) {
    try {
      execSync(`xattr -dr com.apple.quarantine "${target}"`, { stdio: 'ignore' })
      logStartup('H1', 'quarantine-stripped', { target })
    } catch (err) {
      logStartup('H1', 'quarantine-strip-failed', {
        target,
        error: String(err),
      })
    }
  }
}
