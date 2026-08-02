import { describe, expect, it } from 'vitest'

import { takeDiscardMeetingOnMicCancel } from '../src/lib/micPickerCancel'

describe('mic picker cancel discard', () => {
  it('returns the draft id to delete when capture created a new meeting', () => {
    expect(takeDiscardMeetingOnMicCancel('mtg-new')).toEqual({ deleteId: 'mtg-new' })
  })

  it('returns null when capture was for an existing meeting', () => {
    expect(takeDiscardMeetingOnMicCancel(null)).toEqual({ deleteId: null })
  })
})
