#!/usr/bin/env node
/**
 * Verify a macOS DMG contains an ad-hoc signed Clarifi.app that codesign accepts.
 * Fails the publish pipeline when the bundle inside the DMG is unsigned/broken.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function log(_hypothesisId, message, data) {
  console.log(`[verify-signed] ${message}`, data ? JSON.stringify(data) : '')
}

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

const dmgPath = process.argv[2]
if (!dmgPath || !fs.existsSync(dmgPath)) {
  log('H1', 'DMG missing', { dmgPath })
  process.exit(2)
}

const mountPoint = path.join(os.tmpdir(), `clarifi-signed-${process.pid}`)
fs.mkdirSync(mountPoint, { recursive: true })

try {
  sh(`hdiutil attach -nobrowse -quiet "${path.resolve(dmgPath)}" -mountpoint "${mountPoint}"`)
  const appName = fs.readdirSync(mountPoint).find((e) => e.endsWith('.app'))
  if (!appName) {
    log('H5', 'No .app inside DMG', { mountPoint })
    process.exit(3)
  }

  const appPath = path.join(mountPoint, appName)
  const codesignOut = sh(`codesign -dv --verbose=4 "${appPath}" 2>&1 || true`)
  const verifyOut = sh(`codesign --verify --deep "${appPath}" 2>&1 && echo OK || true`)
  const signatureType = codesignOut.includes('Signature=adhoc')
    ? 'adhoc'
    : codesignOut.includes('not signed')
      ? 'unsigned'
      : 'other'

  log('H1', 'DMG bundle signature', {
    dmgPath,
    signatureType,
    verifyOk: verifyOut.includes('OK'),
    team: codesignOut.match(/TeamIdentifier=(.*)/)?.[1] ?? 'none',
  })

  if (signatureType !== 'adhoc' || !verifyOut.includes('OK')) {
    log('H2', 'DMG bundle not ad-hoc signed', {
      verifyOut: verifyOut.split('\n').slice(0, 2).join(' | '),
    })
    process.exit(1)
  }

  log('H4', 'DMG bundle passes ad-hoc verify', { dmgPath })
} finally {
  try {
    sh(`hdiutil detach "${mountPoint}" -quiet`)
  } catch {
    /* ignore */
  }
  try {
    fs.rmdirSync(mountPoint)
  } catch {
    /* ignore */
  }
}
