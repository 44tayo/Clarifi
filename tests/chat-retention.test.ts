import { describe, expect, it } from 'vitest'

import {
  listChatThreadKeys,
  purgeChatThreads,
  shouldPurgeMeetingByAge,
} from '../shared/chatRetention'

describe('chat retention policy', () => {
  it('lists and purges local chat thread keys', () => {
    const removed: string[] = []
    const keys = [
      'clarifi-chat-thread:home',
      'clarifi-chat-thread:meeting:abc',
      'unrelated',
    ]
    expect(listChatThreadKeys(keys)).toEqual([
      'clarifi-chat-thread:home',
      'clarifi-chat-thread:meeting:abc',
    ])
    const count = purgeChatThreads(
      {
        removeItem: (key) => {
          removed.push(key)
        },
      },
      listChatThreadKeys(keys),
    )
    expect(count).toBe(2)
    expect(removed).toEqual([
      'clarifi-chat-thread:home',
      'clarifi-chat-thread:meeting:abc',
    ])
  })

  it('handles retention boundary cases', () => {
    const now = Date.UTC(2026, 7, 4)
    expect(shouldPurgeMeetingByAge(now - 6 * 86400000, now, 7)).toBe(false)
    expect(shouldPurgeMeetingByAge(now - 8 * 86400000, now, 7)).toBe(true)
    expect(shouldPurgeMeetingByAge(now, now, 0)).toBe(false)
  })
})
