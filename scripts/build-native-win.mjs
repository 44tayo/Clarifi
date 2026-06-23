#!/usr/bin/env node
/**
 * Build dictation_ptt native module on Windows CI / local Windows dev.
 */
import { execSync } from 'node:child_process'
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const DEBUG_LOG = join(root, '../.cursor/debug-6989d7.log')

function logDebug(hypothesisId, message, data = {}) {
  // #region agent log
  try {
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

console.log(`Building dictation_ptt for Electron ${electronVersion} (win32 x64)...`)
logDebug('H2', 'native-win-build-start', { electronVersion })
try {
  execSync(
    `npx --yes node-gyp@10 rebuild --target=${electronVersion} --arch=x64 --dist-url=https://electronjs.org/headers -- dictation_ptt`,
    { cwd: join(root, 'native'), stdio: 'inherit' },
  )
} catch (err) {
  logDebug('H2', 'native-win-build-failed', { error: String(err) })
  throw err
}

const built = join(root, 'native/build/Release/dictation_ptt.node')
if (!existsSync(built)) {
  console.error('ERROR: dictation_ptt.node was not produced')
  process.exit(1)
}

copyFileSync(built, join(root, 'resources/dictation_ptt.node'))
logDebug('H2', 'native-win-build-complete', { output: 'resources/dictation_ptt.node' })
console.log('Built resources/dictation_ptt.node (Windows)')
