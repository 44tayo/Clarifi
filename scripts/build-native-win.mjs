#!/usr/bin/env node
/**
 * Build dictation_ptt native module on Windows CI / local Windows dev.
 */
import { execSync } from 'node:child_process'
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const nativeDir = join(root, 'native')
const DEBUG_LOG = join(root, '.cursor/debug-6989d7.log')

function logDebug(hypothesisId, message, data = {}) {
  // #region agent log
  try {
    mkdirSync(join(root, '.cursor'), { recursive: true })
    const line = `${JSON.stringify({
      sessionId: '6989d7',
      hypothesisId,
      location: 'build-native-win.mjs',
      message,
      data,
      timestamp: Date.now(),
    })}\n`
    appendFileSync(DEBUG_LOG, line)
  } catch {
    /* ignore */
  }
  // #endregion
}

if (process.platform !== 'win32') {
  console.log(`Skipping Windows native build on ${process.platform}`)
  process.exit(0)
}

const electronPkg = JSON.parse(
  readFileSync(join(root, 'node_modules/electron/package.json'), 'utf8'),
)
const electronVersion = electronPkg.version

mkdirSync(join(root, 'resources'), { recursive: true })

const bindingPath = join(nativeDir, 'binding.gyp')
const bindingBackup = join(nativeDir, 'binding.gyp.bak')
const bindingWin = join(nativeDir, 'binding.win.gyp')

if (!existsSync(bindingWin)) {
  console.error(`ERROR: Missing ${bindingWin}`)
  process.exit(1)
}

console.log(`Building dictation_ptt for Electron ${electronVersion} (win32 x64)...`)
logDebug('H5', 'native-win-build-start', { electronVersion, binding: 'binding.win.gyp' })

copyFileSync(bindingPath, bindingBackup)
copyFileSync(bindingWin, bindingPath)
rmSync(join(nativeDir, 'build'), { recursive: true, force: true })

try {
  execSync(
    `npx --yes node-gyp@10 rebuild --target=${electronVersion} --arch=x64 --dist-url=https://electronjs.org/headers`,
    { cwd: nativeDir, stdio: 'inherit' },
  )
} catch (err) {
  logDebug('H5', 'native-win-build-failed', { error: String(err) })
  throw err
} finally {
  try {
    if (existsSync(bindingBackup)) {
      copyFileSync(bindingBackup, bindingPath)
      unlinkSync(bindingBackup)
    }
  } catch (restoreErr) {
    console.warn('Failed to restore binding.gyp:', restoreErr)
  }
}

const built = join(nativeDir, 'build/Release/dictation_ptt.node')
if (!existsSync(built)) {
  logDebug('H5', 'native-win-build-missing-output', { expected: built })
  console.error('ERROR: dictation_ptt.node was not produced')
  process.exit(1)
}

copyFileSync(built, join(root, 'resources/dictation_ptt.node'))
logDebug('H5', 'native-win-build-complete', { output: 'resources/dictation_ptt.node' })
console.log('Built resources/dictation_ptt.node (Windows)')
