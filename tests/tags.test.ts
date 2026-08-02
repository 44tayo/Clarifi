import { describe, expect, it } from 'vitest'

import { aggregateTags, normalizeTags } from '../shared/tags'

describe('normalizeTags', () => {
  it('trims whitespace and drops blank entries', () => {
    expect(normalizeTags(['  Sales  ', '', '   ', 'Q3'])).toEqual(['Sales', 'Q3'])
  })

  it('dedupes case-insensitively, keeping first-seen casing', () => {
    expect(normalizeTags(['Sales', 'sales', 'SALES', 'Sales Call'])).toEqual([
      'Sales',
      'Sales Call',
    ])
  })

  it('returns an empty array for all-blank input', () => {
    expect(normalizeTags(['', '   ', '\n'])).toEqual([])
  })
})

describe('aggregateTags', () => {
  it('collects distinct tags across meetings, sorted alphabetically', () => {
    const result = aggregateTags([
      ['Sales', 'Q3'],
      ['sales', 'Onboarding'],
      undefined,
      [],
    ])
    expect(result).toEqual(['Onboarding', 'Q3', 'Sales'])
  })

  it('returns an empty array when no meetings have tags', () => {
    expect(aggregateTags([undefined, [], undefined])).toEqual([])
  })
})

describe('tag filtering', () => {
  it('filters meetings by tag name case-insensitively', () => {
    const meetings = [
      { id: '1', tags: ['Sales'] },
      { id: '2', tags: ['sales', 'q3'] },
      { id: '3', tags: ['Onboarding'] },
    ]
    const wanted = 'sales'
    const matches = meetings.filter((m) =>
      (m.tags ?? []).some((tag) => tag.toLowerCase() === wanted),
    )
    expect(matches.map((m) => m.id)).toEqual(['1', '2'])
  })
})
