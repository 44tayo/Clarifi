#!/usr/bin/env node
/**
 * Verify a download URL serves a real binary (not an LFS pointer or HTML error page).
 */
import fs from 'node:fs'
import https from 'node:https'
import http from 'node:http'

const DEBUG_ENDPOINT =
  'http://127.0.0.1:7545/ingest/c19994d6-505e-4d73-855e-70ee46048b6f'
const SESSION_ID = '6989d7'
const LOG_PATH = '/Users/tschool/Desktop/Clarifi.c/.cursor/debug-6989d7.log'

function log(hypothesisId, message, data) {
  const payload = {
    sessionId: SESSION_ID,
    runId: process.env.DEBUG_RUN_ID || 'verify-download',
    hypothesisId,
    location: 'scripts/verify-download-artifact.mjs',
    message,
    data,
    timestamp: Date.now(),
  }
  // #region agent log
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': SESSION_ID,
    },
    body: JSON.stringify(payload),
  }).catch(() => {})
  try {
    fs.appendFileSync(LOG_PATH, `${JSON.stringify(payload)}\n`)
  } catch {
    /* ignore */
  }
  // #endregion
  console.log(`[verify-download] ${message}`, data ? JSON.stringify(data) : '')
}

function fetchHead(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const req = lib.request(url, { method: 'HEAD' }, (res) => {
      resolve({
        status: res.statusCode ?? 0,
        contentLength: Number(res.headers['content-length'] || 0),
        contentType: res.headers['content-type'] || '',
      })
      res.resume()
    })
    req.on('error', reject)
    req.end()
  })
}

function fetchPrefix(url, bytes = 256) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, (res) => {
      const chunks = []
      res.on('data', (c) => {
        chunks.push(c)
        if (Buffer.concat(chunks).length >= bytes) {
          req.destroy()
          resolve(Buffer.concat(chunks).subarray(0, bytes))
        }
      })
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })
    req.on('error', reject)
  })
}

const url = process.argv[2]
const minBytes = Number(process.argv[3] || 1_000_000)

if (!url) {
  console.error('Usage: verify-download-artifact.mjs <url> [minBytes]')
  process.exit(2)
}

try {
  const head = await fetchHead(url)
  const prefix = await fetchPrefix(url)
  const prefixText = prefix.toString('utf8', 0, Math.min(prefix.length, 80))
  const isLfsPointer = prefixText.startsWith('version https://git-lfs.github.com')
  const isHtml = prefixText.trimStart().startsWith('<!')

  log('H1', 'Download URL probe', {
    url,
    status: head.status,
    contentLength: head.contentLength,
    contentType: head.contentType,
    isLfsPointer,
    isHtml,
    prefixSample: prefixText.slice(0, 40),
  })

  if (head.status !== 200 || isLfsPointer || isHtml || head.contentLength < minBytes) {
    log('H2', 'Download URL invalid', {
      reason: isLfsPointer
        ? 'git-lfs-pointer'
        : isHtml
          ? 'html-not-binary'
          : head.contentLength < minBytes
            ? 'too-small'
            : `http-${head.status}`,
    })
    process.exit(1)
  }

  log('H4', 'Download URL valid binary', { url, contentLength: head.contentLength })
} catch (err) {
  log('H3', 'Download URL probe failed', { url, error: String(err) })
  process.exit(1)
}
