import { describe, expect, it } from 'vitest'

import type { SidebarSelection } from '../src/types/navigation'

function openScopedChatNav(
  kind: 'person' | 'company',
  value: string,
): SidebarSelection {
  return kind === 'person'
    ? { view: 'chat', personEmail: value }
    : { view: 'chat', company: value }
}

describe('entity scoped chat navigation', () => {
  it('opens chat scoped to person', () => {
    expect(openScopedChatNav('person', 'maya@acme.com')).toEqual({
      view: 'chat',
      personEmail: 'maya@acme.com',
    })
  })

  it('opens chat scoped to company', () => {
    expect(openScopedChatNav('company', 'acme.com')).toEqual({
      view: 'chat',
      company: 'acme.com',
    })
  })
})
