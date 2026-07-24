import { describe, expect, it } from 'vitest'

import {
  maxTokensForEffort,
  normalizeChatEffort,
  resolveChatApiModel,
} from '../shared/chatOptions'

describe('chatOptions', () => {
  it('resolves default and selected Anthropic models', () => {
    expect(resolveChatApiModel(undefined)).toBe('claude-haiku-4-5-20251001')
    expect(resolveChatApiModel('claude-haiku-4-5')).toBe('claude-haiku-4-5-20251001')
    expect(resolveChatApiModel('claude-fable-5')).toBe('claude-sonnet-4-6')
  })

  it('maps effort to max tokens', () => {
    expect(maxTokensForEffort('low')).toBe(1024)
    expect(maxTokensForEffort('medium')).toBe(2048)
    expect(maxTokensForEffort('max')).toBe(4096)
    expect(normalizeChatEffort('nope')).toBe('medium')
  })
})
