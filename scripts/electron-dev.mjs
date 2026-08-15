#!/usr/bin/env node
/**
 * Start Vite + Electron without inheriting Cursor's ELECTRON_RUN_AS_NODE=1,
 * which otherwise launches the wrong Electron binary and aborts on macOS.
 */
import { spawn } from 'node:child_process'

const env = { ...process.env, NODE_ENV: 'development' }
delete env.ELECTRON_RUN_AS_NODE

const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const child = spawn(cmd, ['vite'], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
