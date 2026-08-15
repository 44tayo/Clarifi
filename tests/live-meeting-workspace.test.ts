import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..')

function readSrc(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

describe('live MeetingWorkspace (Jamie-style tabs)', () => {
  const workspace = readSrc('src/components/MeetingWorkspace.tsx')
  const notes = readSrc('src/components/NotesEditor.tsx')
  const styles = readSrc('src/styles/app.css')

  it('uses Scratchpad / Transcript tabs instead of split panes while live', () => {
    expect(workspace).toContain("type LiveTab = 'scratchpad' | 'transcript'")
    expect(workspace).toContain('live-meeting-tabs')
    expect(workspace).toContain('Scratchpad')
    expect(workspace).toContain('Transcript')
    expect(workspace).toContain('liveTab === \'scratchpad\'')
    expect(workspace).toContain('liveTab === \'transcript\'')
  })

  it('shows a prominent Stop control in the live header', () => {
    expect(workspace).toContain('live-meeting-stop')
    expect(workspace).toMatch(/live-meeting-stop[\s\S]*Stop/)
  })

  it('uses private-notes empty state copy', () => {
    expect(notes).toContain("placeholder = 'Write private notes...'")
    expect(workspace).toContain('Write private notes...')
  })

  it('styles the live chrome with Clarifi tokens', () => {
    expect(styles).toContain('.live-meeting-header')
    expect(styles).toContain('.live-meeting-tab.is-active')
    expect(styles).toContain('var(--ds-accent)')
  })
})

describe('expanded widget notepad aligns with live workspace', () => {
  const panel = readSrc('src/components/widget/WidgetNotepadPanel.tsx')
  const widgetCss = readSrc('src/styles/widget.css')

  it('exposes Scratchpad / Transcript text tabs', () => {
    expect(panel).toContain('widget-live-tabs')
    expect(panel).toContain('Scratchpad')
    expect(panel).toContain('Transcript')
    expect(panel).toContain('Write private notes')
  })

  it('avoids Silent activity clutter in the footer', () => {
    expect(panel).toContain("activity !== 'silent'")
  })

  it('shares accent underline tab treatment', () => {
    expect(widgetCss).toContain('.widget-live-tab.is-active')
    expect(widgetCss).toContain('var(--ds-accent)')
  })
})
