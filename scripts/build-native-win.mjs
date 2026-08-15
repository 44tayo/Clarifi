#!/usr/bin/env node
/**
 * Build dictation_ptt native module on Windows CI / local Windows dev.
 */
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const nativeDir = join(root, 'native')

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

copyFileSync(bindingPath, bindingBackup)
copyFileSync(bindingWin, bindingPath)
rmSync(join(nativeDir, 'build'), { recursive: true, force: true })

try {
  execSync(
    `npx --yes node-gyp@10 rebuild --target=${electronVersion} --arch=x64 --dist-url=https://electronjs.org/headers`,
    { cwd: nativeDir, stdio: 'inherit' },
  )
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
  console.error('ERROR: dictation_ptt.node was not produced')
  process.exit(1)
}

copyFileSync(built, join(root, 'resources/dictation_ptt.node'))
console.log('Built resources/dictation_ptt.node (Windows)')
