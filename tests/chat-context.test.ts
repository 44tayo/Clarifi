import { describe, expect, it } from 'vitest'

import { packMeetingsForChat } from '../shared/chatContext'

describe('packMeetingsForChat', () => {
  it('packs newest meetings first and cites titles', () => {
    const packed = packMeetingsForChat([
      {
        id: '1',
        title: 'Old',
        summary: 'Old summary',
        createdAt: 1,
        startedAt: 1,
      },
      {
        id: '2',
        title: 'New',
        summary: 'New summary',
        createdAt: 2,
        startedAt: 100,
      },
    ])
    expect(packed).toContain('multiple Clarifi meetings')
    expect(packed.indexOf('### New')).toBeLessThan(packed.indexOf('### Old'))
  })

  it('respects a small character budget', () => {
    const packed = packMeetingsForChat(
      [
        { id: '1', title: 'A', summary: 'aaaa'.repeat(200), createdAt: 3, startedAt: 3 },
        { id: '2', title: 'B', summary: 'bbbb'.repeat(200), createdAt: 2, startedAt: 2 },
        { id: '3', title: 'C', summary: 'cccc'.repeat(200), createdAt: 1, startedAt: 1 },
      ],
      500,
    )
    expect(packed).toContain('### A')
    expect(packed).not.toContain('### C')
  })

  it('returns empty when there are no meetings', () => {
    expect(packMeetingsForChat([])).toBe('')
  })
})
