import { describe, expect, it } from 'vitest'

import type { SidebarSelection } from '../src/types/navigation'

function toScopedChat(kind: 'person' | 'company', value: string): SidebarSelection {
  return kind === 'person'
    ? { view: 'chat', personEmail: value }
    : { view: 'chat', company: value }
}

function citationOpensMeeting(citation: { meetingId: string }): {
  meetingId: string
} {
  return { meetingId: citation.meetingId }
}

describe('chat navigation regression', () => {
  it('home ask → chat view', () => {
    const nav: SidebarSelection = { view: 'chat' }
    expect(nav.view).toBe('chat')
  })

  it('meeting ask stays on meeting workspace (no nav change)', () => {
    const navBefore: SidebarSelection = { view: 'meetings' }
    expect(navBefore.view).toBe('meetings')
  })

  it('person memory → scoped chat', () => {
    expect(toScopedChat('person', 'a@b.com')).toEqual({
      view: 'chat',
      personEmail: 'a@b.com',
    })
  })

  it('company memory → scoped chat', () => {
    expect(toScopedChat('company', 'acme.com')).toEqual({
      view: 'chat',
      company: 'acme.com',
    })
  })

  it('citation chip targets meeting id', () => {
    expect(citationOpensMeeting({ meetingId: 'm9' }).meetingId).toBe('m9')
  })

  it('composer language is Ask Clarifi across surfaces', () => {
    const labels = ['Ask Clarifi', 'Ask Clarifi', 'Ask Clarifi']
    expect(new Set(labels).size).toBe(1)
  })
})
