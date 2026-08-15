import { describe, expect, it } from 'vitest'

import {
  extractActionItems,
  formatBullets,
  parseEnhancedSections,
  parseMarkdownBlocks,
  stripInlineMarkdown,
} from '../src/lib/parseEnhancedNotes'

/** Golden fixture approximating a Granola-style Enhanced note (Robertson-like structure). */
const GRANOLA_STYLE_NOTE = `# Robertson Scholarship interview prep
- Candidate: Jordan Lee, applying for the Robertson Scholarship
- Interviewers: Maya Chen (alumni), Dr. Patel (faculty)
- Focus: leadership narrative, research fit, and community impact

# Leadership narrative
- Jordan led the campus climate initiative across three residences
  - Recruited 18 volunteers in the first semester
  - Raised $12,400 for heat-pump retrofits
  - Presented outcomes to the Board on March 12
- Advice from Maya on framing:
  > Lead with the problem you owned, then the coalition you built — not the award.

# Research fit
- Aligns with Patel's lab on urban heat islands
  - Cited the 2024 NOAA neighborhood heat study
  - Proposed a summer pilot with two census tracts
- Open question: whether funding covers RA stipend or only materials

# Next Steps
- **Send thank-you email** to Maya and Dr. Patel by Friday
- **Draft one-page research proposal** with budget line items
- **Schedule mock interview** with career services next week
- **Update CV** with climate initiative metrics ($12,400 / 18 volunteers)
`

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

  it('keeps Next Steps in Summary for reading continuity', () => {
    const sections = parseEnhancedSections(`# Topic
- Point

# Next Steps
- **Do the thing**
`)
    expect(sections.map((s) => s.title)).toEqual(['Topic', 'Next Steps'])
  })
})

describe('Granola-style enhance fixture', () => {
  it('yields multiple topical sections with nested list markers', () => {
    const sections = parseEnhancedSections(GRANOLA_STYLE_NOTE)
    expect(sections.length).toBeGreaterThanOrEqual(3)
    expect(sections.map((s) => s.title)).toEqual([
      'Robertson Scholarship interview prep',
      'Leadership narrative',
      'Research fit',
      'Next Steps',
    ])

    const leadership = sections.find((s) => s.title === 'Leadership narrative')
    expect(leadership?.body).toMatch(/^\s*- /m)
    expect(leadership?.body).toMatch(/\n\s{2,}- /)
    expect(leadership?.body).toContain('>')
  })

  it('extracts ≥3 Next Steps tasks and strips bold markers', () => {
    const items = extractActionItems(GRANOLA_STYLE_NOTE)
    expect(items.length).toBeGreaterThanOrEqual(3)
    expect(items[0]).toBe('Send thank-you email to Maya and Dr. Patel by Friday')
    expect(items.every((item) => !item.includes('**'))).toBe(true)
  })

  it('parses nested lists and blockquote callouts', () => {
    const leadership = parseEnhancedSections(GRANOLA_STYLE_NOTE).find(
      (s) => s.title === 'Leadership narrative',
    )
    expect(leadership).toBeTruthy()
    const blocks = parseMarkdownBlocks(leadership!.body)
    const list = blocks.find((b) => b.type === 'list')
    expect(list?.type).toBe('list')
    if (list?.type === 'list') {
      expect(list.items.length).toBeGreaterThanOrEqual(1)
      const nested = list.items.some((item) => (item.nested?.length ?? 0) > 0)
      expect(nested).toBe(true)
    }
    const quote = blocks.find((b) => b.type === 'blockquote')
    expect(quote?.type).toBe('blockquote')
  })

  it('also extracts from ## Action items headings', () => {
    const md = `## Overview
Hello

## Action items
- **Ship** the parser
- Write tests
`
    expect(extractActionItems(md)).toEqual(['Ship the parser', 'Write tests'])
  })

  it('stripInlineMarkdown removes bold wrappers', () => {
    expect(stripInlineMarkdown('**Send thank-you email** today')).toBe(
      'Send thank-you email today',
    )
  })
})
