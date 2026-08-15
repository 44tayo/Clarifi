import { describe, expect, it } from 'vitest'

import { guardCitations, resolveTranscriptEntryId } from '../shared/citationNav'

describe('guardCitations', () => {
  it('returns empty when no evidence', () => {
    expect(guardCitations(undefined)).toEqual([])
    expect(guardCitations([])).toEqual([])
    expect(guardCitations([{ title: 'Only title' }])).toEqual([])
    expect(guardCitations([{ meetingId: 'm1' }])).toEqual([])
  })

  it('keeps valid citations with optional jump fields', () => {
    expect(
      guardCitations([
        {
          meetingId: ' m1 ',
          title: ' Kickoff ',
          quote: ' ship it ',
          entryId: ' e1 ',
          audioStartMs: 1200,
        },
      ]),
    ).toEqual([
      {
        meetingId: 'm1',
        title: 'Kickoff',
        quote: 'ship it',
        entryId: 'e1',
        audioStartMs: 1200,
      },
    ])
  })
})

describe('resolveTranscriptEntryId', () => {
  const entries = [
    { id: 'a', text: 'Hello world', audioStartMs: 1000 },
    { id: 'b', text: 'We will ship pricing in Q3', audioStartMs: 5000 },
    { id: 'c', text: 'Hiring two engineers', audioStartMs: 9000 },
  ]

  it('prefers entryId', () => {
    expect(resolveTranscriptEntryId(entries, { entryId: 'b' })).toBe('b')
  })

  it('matches nearest audioStartMs', () => {
    expect(resolveTranscriptEntryId(entries, { audioStartMs: 5100 })).toBe('b')
  })

  it('falls back to quote substring', () => {
    expect(resolveTranscriptEntryId(entries, { quote: 'ship pricing' })).toBe('b')
  })

  it('returns null when nothing matches', () => {
    expect(resolveTranscriptEntryId(entries, { quote: 'no such line' })).toBeNull()
  })
})
