import { describe, expect, it } from 'vitest'

import { packMeetingsForChat, selectMeetingsForQuery } from '../shared/chatContext'

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
      '',
      500,
    )
    expect(packed).toContain('### A')
    expect(packed).not.toContain('### C')
  })

  it('returns empty when there are no meetings', () => {
    expect(packMeetingsForChat([])).toBe('')
  })

  it('prefers relevant meetings for the query', () => {
    const meetings = [
      { id: '1', title: 'Pricing review', summary: 'Discussed annual contracts', createdAt: 1 },
      { id: '2', title: 'Hiring sync', summary: 'Frontend interview loop', createdAt: 2 },
      { id: '3', title: 'QBR', summary: 'Contract pricing discount approval', createdAt: 3 },
    ]
    const selected = selectMeetingsForQuery(meetings, 'pricing contract', 2)
    expect(selected.map((m) => m.id)).toEqual(['3', '1'])
  })

  it('packs context using query-aware selection', () => {
    const packed = packMeetingsForChat(
      [
        { id: '1', title: 'Infra', summary: 'Kubernetes cluster upgrades', createdAt: 1 },
        { id: '2', title: 'Customer pricing', summary: 'Requested contract discount', createdAt: 2 },
      ],
      'pricing discount',
    )
    expect(packed).toContain('### Customer pricing')
  })
})
