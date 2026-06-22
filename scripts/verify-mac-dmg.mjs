#!/usr/bin/env node
/**
 * Verify a macOS DMG / .app is signed for public distribution.
 * Emits debug telemetry and exits non-zero when not installable via Gatekeeper.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function log(_hypothesisId, message, data) {
  console.log(`[verify] ${message}`, data ? JSON.stringify(data) : '')
}

function detachDmgIfMounted(dmgPath) {
  try {
    const info = sh('hdiutil info 2>&1 || true')
    if (!info.includes(dmgPath)) return
    const blocks = info.split('================================================')
    for (const block of blocks) {
      if (!block.includes(dmgPath)) continue
      const mountPoint = block
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.startsWith('/private/') || line.startsWith('/Volumes/'))
      if (mountPoint) {
        sh(`hdiutil detach "${mountPoint}" -quiet 2>&1 || true`)
      }
    }
  } catch {
    /* ignore */
  }
}

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

const dmgPath =
  process.argv[2] ||
  path.join(process.cwd(), 'web/public/downloads/Clarifi-0.1.0-arm64.dmg')

if (!fs.existsSync(dmgPath)) {
  log('H1', 'DMG missing', { dmgPath })
  process.exit(2)
}

const mountPoint = path.join(os.tmpdir(), `clarifi-verify-${process.pid}`)
let appPath = ''

try {
  detachDmgIfMounted(dmgPath)
  fs.mkdirSync(mountPoint, { recursive: true })
  sh(`hdiutil attach -nobrowse -quiet "${dmgPath}" -mountpoint "${mountPoint}"`)

  const entries = fs.readdirSync(mountPoint)
  const appName = entries.find((e) => e.endsWith('.app'))
  if (!appName) {
    log('H5', 'No .app bundle inside DMG', { entries })
    process.exit(3)
  }

  appPath = path.join(mountPoint, appName)
  const codesignOut = sh(`codesign -dv --verbose=4 "${appPath}" 2>&1 || true`)
  const signatureType = codesignOut.includes('Signature=adhoc')
    ? 'adhoc'
    : codesignOut.includes('Authority=Developer ID Application')
      ? 'developer-id'
      : codesignOut.includes('Authority=Apple Development')
        ? 'apple-development'
        : 'unknown'

  let spctlStatus = 'unknown'
  let spctlDetail = ''
  try {
    spctlDetail = sh(`spctl -a -vv -t install "${appPath}" 2>&1`)
    spctlStatus = spctlDetail.includes('accepted') ? 'accepted' : 'rejected'
  } catch (err) {
    spctlDetail = String(err.stderr || err.stdout || err.message)
    spctlStatus = 'rejected'
  }

  let stapleStatus = 'unknown'
  try {
    stapleStatus = sh(`xcrun stapler validate "${appPath}" 2>&1`)
  } catch (err) {
    stapleStatus = String(err.stderr || err.message)
  }

  let quarantine = ''
  try {
    quarantine = sh(`xattr -p com.apple.quarantine "${dmgPath}" 2>&1 || echo none`)
  } catch {
    quarantine = 'none'
  }

  const distributable =
    signatureType === 'developer-id' &&
    spctlStatus === 'accepted' &&
    stapleStatus.toLowerCase().includes('worked')

  log('H1', 'DMG signature inspection', {
    dmgPath,
    signatureType,
    spctlStatus,
    stapleStatus: stapleStatus.split('\n')[0],
    quarantine: quarantine === 'none' ? 'none' : 'present',
    distributable,
  })

  log('H2', 'Gatekeeper detail', {
    spctlDetail: spctlDetail.split('\n').slice(0, 3).join(' | '),
  })

  log('H3', 'Codesign authority', {
    authorityLine:
      codesignOut
        .split('\n')
        .find((l) => l.includes('Authority=')) || 'none',
    flagsLine:
      codesignOut
        .split('\n')
        .find((l) => l.includes('flags=')) || 'none',
  })

  if (!distributable) {
    log('H4', 'DMG not distributable to end users', {
      reason:
        signatureType !== 'developer-id'
          ? 'missing-developer-id-signature'
          : spctlStatus !== 'accepted'
            ? 'gatekeeper-rejected'
            : 'not-stapled',
    })
    process.exit(1)
  }

  log('H4', 'DMG passes distribution checks', { dmgPath })
  process.exit(0)
} finally {
  if (appPath) {
    try {
      sh(`hdiutil detach "${mountPoint}" -quiet`)
    } catch {
      /* ignore */
    }
  }
  try {
    fs.rmdirSync(mountPoint)
  } catch {
    /* ignore */
  }
}
