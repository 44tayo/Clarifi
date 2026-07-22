import { app } from 'electron'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const DEBUG_SESSION_LOG = path.join(
  process.cwd(),
  '.cursor',
  'debug-977aa0.log',
)

function logPath(): string {
  return path.join(os.homedir(), 'Library', 'Logs', 'Clarifi', 'startup.log')
}

function writeLine(file: string, payload: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.appendFileSync(file, `${JSON.stringify(payload)}\n`)
}

export function logStartup(
  hypothesisId: string,
  message: string,
  data: Record<string, unknown> = {},
): void {
  const payload = {
    sessionId: '977aa0',
    runId: 'electron-startup',
    hypothesisId,
    location: 'electron/startupDiagnostics.ts',
    message,
    data: {
      ...data,
      pid: process.pid,
      packaged: app.isPackaged,
      execPath: process.execPath,
      electronRunAsNode: process.env.ELECTRON_RUN_AS_NODE ?? null,
    },
    timestamp: Date.now(),
  }
  try {
    writeLine(logPath(), payload)
  } catch {
    /* ignore */
  }
  try {
    writeLine(DEBUG_SESSION_LOG, payload)
  } catch {
    /* ignore */
  }
  // #region agent log
  fetch('http://127.0.0.1:7322/ingest/1a7943fc-ddb6-4af4-85aa-dbaa3426b428', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '977aa0',
    },
    body: JSON.stringify(payload),
  }).catch(() => {})
  // #endregion
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
