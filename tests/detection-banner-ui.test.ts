import { describe, expect, it } from 'vitest'

import { DETECTION_BANNER_DISMISS_MS } from '../shared/meetingDetection'
import { shouldStartHidden } from '../electron/loginItem'

describe('detection banner UX', () => {
  it('auto-dismisses after a short visible window', () => {
    expect(DETECTION_BANNER_DISMISS_MS).toBe(14_000)
  })
})

describe('login item hidden launch', () => {
  it('honors --hidden for background detection sessions', () => {
    const had = process.argv.includes('--hidden')
    if (!had) process.argv.push('--hidden')
    try {
      expect(shouldStartHidden()).toBe(true)
    } finally {
      if (!had) {
        const idx = process.argv.lastIndexOf('--hidden')
        if (idx >= 0) process.argv.splice(idx, 1)
      }
    }
  })
})
