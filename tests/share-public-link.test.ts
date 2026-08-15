import { describe, expect, it } from 'vitest'

import {
  isShareViewerAuthorized,
  normalizeShareLinkAccess,
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

describe('share link access control', () => {
  it('defaults unknown/missing values to anyone', () => {
    expect(normalizeShareLinkAccess(undefined)).toBe('anyone')
    expect(normalizeShareLinkAccess(null)).toBe('anyone')
    expect(normalizeShareLinkAccess('nonsense')).toBe('anyone')
    expect(normalizeShareLinkAccess('invited')).toBe('invited')
  })

  it('allows anyone-mode links for anonymous requesters', () => {
    expect(
      isShareViewerAuthorized({
        linkAccess: 'anyone',
        ownerEmail: 'owner@example.com',
        invitedEmails: [],
        requesterEmail: null,
      }),
    ).toBe(true)
  })

  it('denies invited-mode links to anonymous (signed-out) requesters', () => {
    expect(
      isShareViewerAuthorized({
        linkAccess: 'invited',
        ownerEmail: 'owner@example.com',
        invitedEmails: ['guest@example.com'],
        requesterEmail: null,
      }),
    ).toBe(false)
  })

  it('denies invited-mode links to signed-in but non-invited requesters', () => {
    expect(
      isShareViewerAuthorized({
        linkAccess: 'invited',
        ownerEmail: 'owner@example.com',
        invitedEmails: ['guest@example.com'],
        requesterEmail: 'stranger@example.com',
      }),
    ).toBe(false)
  })

  it('allows the owner even without being explicitly invited', () => {
    expect(
      isShareViewerAuthorized({
        linkAccess: 'invited',
        ownerEmail: 'Owner@Example.com',
        invitedEmails: [],
        requesterEmail: 'owner@example.com',
      }),
    ).toBe(true)
  })

  it('allows invited emails case-insensitively', () => {
    expect(
      isShareViewerAuthorized({
        linkAccess: 'invited',
        ownerEmail: 'owner@example.com',
        invitedEmails: ['Guest@Example.com'],
        requesterEmail: 'guest@example.com',
      }),
    ).toBe(true)
  })
})
