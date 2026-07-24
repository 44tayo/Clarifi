import { describe, expect, it } from 'vitest'

import { formatBullets, parseEnhancedSections } from '../src/lib/parseEnhancedNotes'

describe('parseEnhancedSections', () => {
  it('maps Summary to Overview and skips Action items', () => {
    const sections = parseEnhancedSections(`## Summary
Hello world

## Key points
- One
- Two

## Action items
- Do thing`)
    expect(sections.map((s) => s.title)).toEqual(['Overview', 'Key points'])
    expect(formatBullets(sections[1]!.body)).toEqual(['One', 'Two'])
  })
})
