import { describe, expect, it } from 'vitest'

import {
  isLikelyHallucination,
  isRepetitiveGarbage,
} from '../electron/transcriptUtils'
import { contactsWithEmailFirst } from '../shared/speakers'

describe('trusted hallucination filter', () => {
  it('keeps conversational fillers when trusted', () => {
    for (const text of ['um', 'uh', 'ok', 'okay', 'yeah', 'so']) {
      expect(isRepetitiveGarbage(text, { trusted: true })).toBe(false)
      expect(isLikelyHallucination(text, 'system', { trusted: true })).toBe(false)
    }
  })

  it('still drops conversational fillers when untrusted', () => {
    expect(isRepetitiveGarbage('yeah')).toBe(true)
    expect(isLikelyHallucination('yeah', 'system')).toBe(true)
  })

  it('still drops Whisper silence junk when trusted', () => {
    expect(isRepetitiveGarbage('iiii', { trusted: true })).toBe(true)
    expect(isLikelyHallucination('iiii', 'system', { trusted: true })).toBe(true)
  })

  it('keeps short real fragments when trusted', () => {
    expect(isLikelyHallucination('Tay put in', 'system', { trusted: true })).toBe(false)
  })
})

describe('contactsWithEmailFirst', () => {
  it('sorts emailed contacts ahead of name-only', () => {
    const people = [
      { displayName: 'Reebok Hybrid' },
      { displayName: 'Tayo', email: 'tayo@example.com' },
      { displayName: 'Coo' },
      { displayName: 'Sam', email: 'sam@clarifi.app' },
    ]
    const sorted = contactsWithEmailFirst(people)
    expect(sorted.map((p) => p.displayName)).toEqual([
      'Tayo',
      'Sam',
      'Reebok Hybrid',
      'Coo',
    ])
  })
})
