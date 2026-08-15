import { describe, expect, it } from 'vitest'

import { formatRecordingElapsed } from '../shared/formatElapsed'

describe('formatRecordingElapsed', () => {
  it('formats under an hour as m:ss', () => {
    const started = Date.parse('2026-08-11T14:00:00.000Z')
    expect(formatRecordingElapsed(started, Date.parse('2026-08-11T14:00:09.000Z'))).toBe('0:09')
    expect(formatRecordingElapsed(started, Date.parse('2026-08-11T14:02:05.000Z'))).toBe('2:05')
  })

  it('formats longer sessions with hours', () => {
    const started = Date.parse('2026-08-11T14:00:00.000Z')
    expect(formatRecordingElapsed(started, Date.parse('2026-08-11T15:03:07.000Z'))).toBe(
      '1:03:07',
    )
  })
})

describe('sidebar live pin contract', () => {
  it('exposes open + stop actions on hover (Jamie pattern)', () => {
    const pin = {
      id: 'm1',
      title: 'Tuesday Meeting',
      startedAt: Date.now(),
      idle: ['title', 'timer'],
      hover: ['Open meeting', 'Stop'],
    }
    expect(pin.hover).toEqual(['Open meeting', 'Stop'])
    expect(pin.idle).toContain('timer')
  })
})
