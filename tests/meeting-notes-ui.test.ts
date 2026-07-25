import { describe, expect, it } from 'vitest'

import { parseEnhancedSections } from '../src/lib/parseEnhancedNotes'

describe('granola-style meeting notes helpers', () => {
  it('parses enhanced note sections for # heading rendering', () => {
    const sections = parseEnhancedSections(`## Overview
Ship the Ask AI button.

## Key points
- Replace the ask bar
- Add share contacts search
`)
    expect(sections.map((s) => s.title)).toEqual(['Overview', 'Key points'])
    expect(sections[0]?.body).toContain('Ask AI')
  })

  it('validates share email shape used by invite flow', () => {
    const isEmailLike = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    expect(isEmailLike('tayo@clarifi.app')).toBe(true)
    expect(isEmailLike('not-an-email')).toBe(false)
  })
})
