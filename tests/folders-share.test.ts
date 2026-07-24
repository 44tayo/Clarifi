import { describe, expect, it } from 'vitest'

import { hasFeature, upgradePlanForFeature } from '../shared/entitlements'
import { resolveTheme } from '../src/lib/theme'

describe('folders assignment helpers', () => {
  it('filters meetings by folder id', () => {
    const meetings = [
      { id: '1', folderIds: ['a'] },
      { id: '2', folderIds: [] },
      { id: '3', folderIds: ['b', 'a'] },
    ]
    const inA = meetings.filter((m) => (m.folderIds ?? []).includes('a'))
    expect(inA.map((m) => m.id)).toEqual(['1', '3'])
  })

  it('unassigns deleted folder ids without removing meetings', () => {
    const meetings = [
      { id: '1', folderIds: ['a', 'b'] },
      { id: '2', folderIds: ['a'] },
    ]
    const deleted = 'a'
    const next = meetings.map((meeting) => ({
      ...meeting,
      folderIds: (meeting.folderIds ?? []).filter((id) => id !== deleted),
    }))
    expect(next[0]?.folderIds).toEqual(['b'])
    expect(next[1]?.folderIds).toEqual([])
    expect(next).toHaveLength(2)
  })
})

describe('share entitlements', () => {
  it('gates share_meetings to Pro+ and keeps folders on every plan', () => {
    expect(hasFeature('free', 'share_meetings')).toBe(false)
    expect(hasFeature('pro', 'share_meetings')).toBe(false)
    expect(hasFeature('pro_plus', 'share_meetings')).toBe(true)
    expect(hasFeature('free', 'folders')).toBe(true)
    expect(hasFeature('pro_plus', 'folders')).toBe(true)
    expect(upgradePlanForFeature('share_meetings')).toBe('pro_plus')
  })
})

describe('theme', () => {
  it('resolves light and dark preferences directly', () => {
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
  })

  it('resolves system from an explicit OS preference', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('share public routes', () => {
  it('allows shared note pages without session', async () => {
    const { isPublicPath } = await import('../web/src/lib/protected-routes')
    expect(isPublicPath('/share/abc123')).toBe(true)
    expect(isPublicPath('/api/share/abc123')).toBe(true)
    expect(isPublicPath('/api/desktop/share')).toBe(true)
    expect(isPublicPath('/api/desktop/shared-with-me')).toBe(true)
  })
})
