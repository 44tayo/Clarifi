#!/usr/bin/env node
// #region agent log
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

const logPath = path.join(__dirname, '../../.cursor/debug-977aa0.log')
const runId = process.env.DEBUG_RUN_ID || 'post-fix'

function log(hypothesisId, message, data) {
  const line = JSON.stringify({
    sessionId: '977aa0',
    hypothesisId,
    location: 'scripts/debug-eb-config.cjs',
    message,
    data,
    timestamp: Date.now(),
    runId,
  })
  fs.appendFileSync(logPath, `${line}\n`)
  console.log(line)
}

async function main() {
  const ymlPath = path.join(__dirname, '../electron-builder.yml')
  const cfg = yaml.load(fs.readFileSync(ymlPath, 'utf8'))
  log('A', 'config keys after fix', {
    keys: Object.keys(cfg),
    hasZip: Object.prototype.hasOwnProperty.call(cfg, 'zip'),
    macTargets: cfg.mac && cfg.mac.target,
  })

  const schema = JSON.parse(
    fs.readFileSync(require.resolve('app-builder-lib/scheme.json'), 'utf8'),
  )
  const { validateSchema } = require('app-builder-lib/out/util/config/schemaValidator')
  try {
    await validateSchema(schema, cfg)
    log('A', 'validateSchema OK', { ok: true })
    process.exitCode = 0
  } catch (err) {
    log('A', 'validateSchema FAIL', {
      ok: false,
      message: String(err.message || err).slice(0, 800),
    })
    process.exitCode = 1
  }
}

main()
// #endregion
