import { describe, expect, it } from 'vitest'

import {
  buildCommandActions,
  scoreMeeting,
  searchMeetings,
} from '../src/lib/commandPalette'

const meetings = [
  {
    id: '1',
    title: 'Product roadmap',
    summary: 'Q3 priorities',
    userNotes: 'Ship folders',
    createdAt: 3,
    startedAt: 3,
  },
  {
    id: '2',
    title: 'Customer call',
    summary: 'Acme renewal',
    enhancedNotes: '## Summary\nThey want SSO',
    createdAt: 2,
    startedAt: 2,
  },
  {
    id: '3',
    title: 'Standup',
    userNotes: 'Blocked on calendar OAuth',
    createdAt: 1,
    startedAt: 1,
  },
]

describe('command palette search', () => {
  it('ranks title prefix matches highest', () => {
    expect(scoreMeeting(meetings[0]!, 'product')).toBeGreaterThan(
      scoreMeeting(meetings[1]!, 'product'),
    )
  })

  it('finds meetings by notes content', () => {
    const hits = searchMeetings(meetings, 'oauth')
    expect(hits.map((m) => m.id)).toEqual(['3'])
  })

  it('includes navigation actions and meeting results', () => {
    const actions = buildCommandActions(meetings, 'chat')
    expect(actions.some((a) => a.id === 'nav-chat')).toBe(true)
    expect(actions.every((a) => a.group === 'Navigation' || a.group === 'Meetings')).toBe(true)
  })

  it('returns recent meetings when query is empty', () => {
    const hits = searchMeetings(meetings, '', 2)
    expect(hits.map((m) => m.id)).toEqual(['1', '2'])
  })
})

describe('shared-with-me public route', () => {
  it('allows desktop shared inbox APIs without browser session', async () => {
    const { isPublicPath } = await import('../web/src/lib/protected-routes')
    expect(isPublicPath('/api/desktop/shared-with-me')).toBe(true)
    expect(isPublicPath('/api/desktop/shared-with-me/item')).toBe(true)
    expect(isPublicPath('/api/desktop/shared-with-me/accept')).toBe(true)
  })
})

describe('shared content preview helper', () => {
  it('prefers summary then enhanced notes', () => {
    const previewFromContent = (content: unknown): string | null => {
      if (!content || typeof content !== 'object') return null
      const c = content as Record<string, unknown>
      const summary = typeof c.summary === 'string' ? c.summary.trim() : ''
      if (summary) return summary.slice(0, 160)
      const notes = typeof c.enhancedNotes === 'string' ? c.enhancedNotes.trim() : ''
      if (notes) return notes.replace(/^#+\s*/gm, '').slice(0, 160)
      return null
    }

    expect(previewFromContent({ summary: ' Hello ', enhancedNotes: '## X' })).toBe('Hello')
    expect(previewFromContent({ enhancedNotes: '## Summary\nBody' })).toBe('Summary\nBody')
  })
})
