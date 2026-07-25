import { describe, expect, it } from 'vitest'

import {
  shareUrlForToken,
  snapshotSharedMeetingContent,
} from '../web/src/lib/share-link'
import { isPublicPath } from '../web/src/lib/protected-routes'

describe('public share link helpers', () => {
  it('builds an https anyone-with-link URL under /share/{token}', () => {
    const url = shareUrlForToken('abc123token', 'https://www.clarifiapp.com')
    expect(url).toBe('https://www.clarifiapp.com/share/abc123token')
  })

  it('snapshots transcript with speaker labels applied', () => {
    const content = snapshotSharedMeetingContent({
      id: 'm1',
      title: 'Design sync',
      summary: 'Shipped share links',
      speakerLabels: { 'Speaker 0': 'Tayo', Me: 'Me' },
      transcript: [
        { speaker: 'Me', text: 'Hello' },
        { speaker: 'Speaker 0', text: 'Hi' },
      ],
      actionItems: ['Publish share table'],
    })

    expect(content.sourceMeetingId).toBe('m1')
    expect(content.transcript).toEqual([
      { speaker: 'Me', text: 'Hello' },
      { speaker: 'Tayo', text: 'Hi' },
    ])
    expect(content.actionItems).toEqual(['Publish share table'])
  })

  it('treats /share pages as public (no login)', () => {
    expect(isPublicPath('/share/abc123')).toBe(true)
    expect(isPublicPath('/api/share/abc123')).toBe(true)
  })
})
