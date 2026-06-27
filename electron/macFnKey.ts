import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

import { app, dialog, shell } from 'electron'

/**
 * Overrides the macOS "Press 🌐 (Globe/Fn) key to" system behavior so that holding
 * Fn for push-to-talk dictation does not pop the emoji & symbols picker.
 *
 * The value lives in the `com.apple.HIToolbox` domain under `AppleFnUsageType`:
 *   0 = Do Nothing, 1 = Change Input Source, 2 = Show Emoji & Symbols, 3 = Start Dictation
 *
 * We back up the original value to disk so a crash can never leave the user's
 * machine permanently changed — the backup is restored on next launch or on quit.
 */

const HITOOLBOX_DOMAIN = 'com.apple.HIToolbox'
const FN_USAGE_KEY = 'AppleFnUsageType'
const FN_DO_NOTHING = '0'

type FnBackup = { hadValue: boolean; value: string | null }

let applied = false

function backupFilePath(): string {
  return path.join(app.getPath('userData'), 'fn-key-backup.json')
}

function readFnUsageType(): string | null {
  try {
    const out = execFileSync('defaults', ['read', HITOOLBOX_DOMAIN, FN_USAGE_KEY], {
      encoding: 'utf-8',
      timeout: 2000,
    })
    const value = out.trim()
    return value.length > 0 ? value : null
  } catch {
    // Non-zero exit means the key isn't set yet.
    return null
  }
}

function writeFnUsageType(value: string): boolean {
  try {
    execFileSync('defaults', ['write', HITOOLBOX_DOMAIN, FN_USAGE_KEY, '-int', value], {
      timeout: 2000,
    })
    return true
  } catch (err) {
    console.warn('[fn-key] Failed to write AppleFnUsageType:', err)
    return false
  }
}

function deleteFnUsageType(): boolean {
  try {
    execFileSync('defaults', ['delete', HITOOLBOX_DOMAIN, FN_USAGE_KEY], { timeout: 2000 })
    return true
  } catch {
    return false
  }
}

/**
 * The emoji/character picker on the Globe key is handled by the system input
 * agent, which caches AppleFnUsageType at launch — so a plain `defaults write`
 * doesn't take effect until re-login. Bouncing the input menu agent forces it to
 * re-read the new value live. Best-effort and safe: launchd relaunches it
 * immediately, and we never touch WindowServer.
 */
function applyFnSettingLive(): void {
  try {
    execFileSync('killall', ['TextInputMenuAgent'], { timeout: 2000, stdio: 'ignore' })
  } catch {
    // Agent may not be running under that name on this macOS version — ignore.
  }
}

function persistBackup(backup: FnBackup): void {
  try {
    fs.writeFileSync(backupFilePath(), JSON.stringify(backup), 'utf-8')
  } catch (err) {
    console.warn('[fn-key] Failed to persist backup:', err)
  }
}

function loadBackup(): FnBackup | null {
  try {
    const raw = fs.readFileSync(backupFilePath(), 'utf-8')
    return JSON.parse(raw) as FnBackup
  } catch {
    return null
  }
}

function clearBackup(): void {
  try {
    fs.unlinkSync(backupFilePath())
  } catch {
    // Already gone.
  }
}

/** Set the Globe/Fn key to "Do Nothing", backing up the prior value first. */
export function suppressFnEmojiPicker(): void {
  if (process.platform !== 'darwin') return
  if (applied) return

  const current = readFnUsageType()
  if (current === FN_DO_NOTHING) {
    // Already "Do Nothing" — nothing to change or restore later.
    applied = true
    return
  }

  // Only capture the original once so repeated start/stop cycles don't clobber it.
  if (!loadBackup()) {
    persistBackup({ hadValue: current !== null, value: current })
  }

  if (writeFnUsageType(FN_DO_NOTHING)) {
    applied = true
    applyFnSettingLive()
    console.log('[fn-key] Globe key set to "Do Nothing" (was', current ?? 'unset', ')')

    // The live apply above is best-effort; if the Globe key was previously bound
    // to the emoji picker, surface the guaranteed System Settings path once so the
    // user can lock it in even if the agent bounce doesn't catch on their macOS.
    maybeShowFnGuidanceOnce()
  }
}

/** Restore the user's original Globe/Fn key behavior from the on-disk backup. */
export function restoreFnEmojiPicker(): void {
  if (process.platform !== 'darwin') return

  const backup = loadBackup()
  if (!backup) {
    applied = false
    return
  }

  if (backup.hadValue && backup.value !== null) {
    writeFnUsageType(backup.value)
    console.log('[fn-key] Globe key restored to', backup.value)
  } else {
    deleteFnUsageType()
    console.log('[fn-key] Globe key reset to system default')
  }

  clearBackup()
  applied = false
}

/**
 * One-time guidance shown only when we cannot intercept the Fn key natively
 * (so macOS would otherwise open the emoji picker). Points the user at the
 * System Settings toggle and never nags again.
 */
export function maybeShowFnGuidanceOnce(): void {
  if (process.platform !== 'darwin') return
  const flagPath = path.join(app.getPath('userData'), 'fn-guidance-shown')
  try {
    if (fs.existsSync(flagPath)) return
    fs.writeFileSync(flagPath, '1', 'utf-8')
  } catch {
    // If we can't persist the flag, still show once this run.
  }

  void dialog
    .showMessageBox({
      type: 'info',
      title: 'Stop the emoji picker on Fn',
      message: 'Hold-to-dictate uses the Fn (Globe) key.',
      detail:
        'Clarifi set this for you, but macOS may need you to confirm it once: System Settings → Keyboard → "Press 🌐 key to" → Do Nothing. This stops the emoji & symbols picker from opening when you dictate.',
      buttons: ['Open Keyboard Settings', 'Later'],
      defaultId: 0,
      cancelId: 1,
    })
    .then((res) => {
      if (res.response === 0) {
        void shell.openExternal(
          'x-apple.systempreferences:com.apple.Keyboard-Settings.extension',
        )
      }
    })
    .catch(() => {
      // Non-fatal.
    })
}
