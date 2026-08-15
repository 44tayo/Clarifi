import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..')

function readSrc(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

describe('live meeting UX cross-check', () => {
  it('keeps Stop off the tray menu (widget + sidebar only)', () => {
    const tray = readSrc('electron/tray.ts')
    expect(tray).toContain("label: 'Open Clarifi'")
    expect(tray).toContain("label: 'Start recording'")
    expect(tray).not.toMatch(/label:\s*['"]Stop/)
    expect(tray).not.toMatch(/audio:stop/)
  })

  it('shows widget + hides main before heavy capture awaits', () => {
    const handlers = readSrc('electron/ipc/handlers.ts')
    const startIdx = handlers.indexOf("'audio:start'")
    expect(startIdx).toBeGreaterThan(-1)
    const slice = handlers.slice(startIdx, startIdx + 4500)
    const widgetIdx = slice.indexOf('createOrShowWidget()')
    const hideIdx = slice.indexOf('mainWin.hide()')
    const systemIdx = slice.indexOf('await beginSystemAudioCapture()')
    const deepgramIdx = slice.indexOf('await beginMicDeepgramCapture()')
    expect(widgetIdx).toBeGreaterThan(-1)
    expect(hideIdx).toBeGreaterThan(-1)
    expect(systemIdx).toBeGreaterThan(hideIdx)
    expect(deepgramIdx).toBeGreaterThan(hideIdx)
    expect(widgetIdx).toBeLessThan(systemIdx)
  })

  it('wires sidebar live pin Open + Stop', () => {
    const sidebar = readSrc('src/components/Sidebar.tsx')
    const app = readSrc('src/App.tsx')
    expect(sidebar).toMatch(/Open meeting/)
    expect(sidebar).toMatch(/Stop/)
    expect(app).toMatch(/onOpenLiveMeeting|handleOpenLiveMeeting/)
    expect(app).toMatch(/onStopLiveMeeting|handleStopLiveMeeting/)
  })

  it('uses Clarifi accent blue in design tokens (not competitor purple/green)', () => {
    const tokens = readSrc('src/styles/app.css')
    expect(tokens).toMatch(/--ds-accent:\s*#2b6cff/i)
    expect(tokens.toLowerCase()).not.toMatch(/--ds-accent:\s*#7c3aed/)
    expect(tokens.toLowerCase()).not.toMatch(/--ds-accent:\s*#22c55e/)
  })
})
