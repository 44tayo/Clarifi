import { describe, expect, it } from 'vitest'

import type { CalendarEvent } from '../shared/calendar'
import {
  DETECTION_DEBOUNCE_MS,
  DETECTION_SESSION_RESET_MS,
  buildDetectedMeetingPayload,
  decideDetectionTick,
  labelForBundleId,
  pickAttributedBundleId,
  selectOverlappingCalendarEvent,
  suggestedTitleForDetection,
} from '../shared/meetingDetection'

function event(
  partial: Partial<CalendarEvent> & Pick<CalendarEvent, 'id' | 'startAt' | 'endAt'>,
): CalendarEvent {
  return {
    provider: 'google',
    title: 'Standup',
    attendees: [],
    meetingUrl: null,
    isOnline: false,
    ...partial,
  }
}

describe('meeting detection attribution', () => {
  it('prefers Zoom over Chrome when both are present', () => {
    expect(
      pickAttributedBundleId(['com.google.Chrome', 'us.zoom.xos']),
    ).toBe('us.zoom.xos')
  })

  it('labels Slack as huddle and FaceTime as call', () => {
    expect(labelForBundleId('com.tinyspeck.slackmacgap').title).toBe('Huddle detected')
    expect(labelForBundleId('com.apple.FaceTime').title).toBe('Call detected')
    expect(labelForBundleId('us.zoom.xos').title).toBe('Meeting detected')
    expect(labelForBundleId('com.google.Chrome').appName).toBe('Chrome')
  })

  it('suggests titles from app when no calendar merge', () => {
    expect(suggestedTitleForDetection(labelForBundleId('us.zoom.xos'))).toBe('Zoom call')
    expect(suggestedTitleForDetection(labelForBundleId('com.google.Chrome'))).toBe(
      'Chrome meeting',
    )
  })
})

describe('calendar merge window', () => {
  it('picks the overlapping event closest to now', () => {
    const now = Date.parse('2026-08-08T15:00:00.000Z')
    const picked = selectOverlappingCalendarEvent(
      [
        event({
          id: 'a',
          title: 'Too early',
          startAt: '2026-08-08T12:00:00.000Z',
          endAt: '2026-08-08T12:30:00.000Z',
        }),
        event({
          id: 'b',
          title: 'Current',
          startAt: '2026-08-08T14:55:00.000Z',
          endAt: '2026-08-08T15:30:00.000Z',
        }),
      ],
      now,
    )
    expect(picked?.id).toBe('b')
    expect(picked?.title).toBe('Current')
  })

  it('builds payload with calendar title when overlapping', () => {
    const now = Date.parse('2026-08-08T15:00:00.000Z')
    const payload = buildDetectedMeetingPayload(
      labelForBundleId('us.zoom.xos'),
      [
        event({
          id: 'b',
          title: 'Design review',
          startAt: '2026-08-08T14:55:00.000Z',
          endAt: '2026-08-08T15:30:00.000Z',
        }),
      ],
      now,
    )
    expect(payload.suggestedTitle).toBe('Design review')
    expect(payload.calendarEvent?.id).toBe('b')
  })
})

describe('decideDetectionTick', () => {
  it('waits for debounce before prompting', () => {
    const t0 = 1_000_000
    const mid = decideDetectionTick({
      snapshot: { inUse: true, pids: [1], bundleIds: ['us.zoom.xos'] },
      nowMs: t0 + DETECTION_DEBOUNCE_MS - 1,
      micActiveSinceMs: t0,
      lastIdleAtMs: null,
      promptedThisSession: false,
      suppress: false,
    })
    expect(mid.decision.action).toBe('none')

    const ready = decideDetectionTick({
      snapshot: { inUse: true, pids: [1], bundleIds: ['us.zoom.xos'] },
      nowMs: t0 + DETECTION_DEBOUNCE_MS,
      micActiveSinceMs: t0,
      lastIdleAtMs: null,
      promptedThisSession: false,
      suppress: false,
    })
    expect(ready.decision.action).toBe('prompt')
    if (ready.decision.action === 'prompt') {
      expect(ready.decision.label.appName).toBe('Zoom')
    }
    expect(ready.promptedThisSession).toBe(true)
  })

  it('suppresses while Clarifi is already recording', () => {
    const t0 = 1_000_000
    const result = decideDetectionTick({
      snapshot: { inUse: true, pids: [1], bundleIds: ['us.zoom.xos'] },
      nowMs: t0 + DETECTION_DEBOUNCE_MS + 10,
      micActiveSinceMs: t0,
      lastIdleAtMs: null,
      promptedThisSession: false,
      suppress: true,
    })
    expect(result.decision.action).toBe('none')
  })

  it('skips prompting for muted bundle IDs', () => {
    const t0 = 1_000_000
    const result = decideDetectionTick({
      snapshot: { inUse: true, pids: [1], bundleIds: ['com.apple.Safari'] },
      nowMs: t0 + DETECTION_DEBOUNCE_MS + 10,
      micActiveSinceMs: t0,
      lastIdleAtMs: null,
      promptedThisSession: false,
      suppress: false,
      mutedBundleIds: ['com.apple.Safari'],
    })
    expect(result.decision.action).toBe('none')
    expect(result.promptedThisSession).toBe(false)
  })

  it('resets session after idle timeout so a later call can prompt again', () => {
    const idleStart = 2_000_000
    const result = decideDetectionTick({
      snapshot: { inUse: false, pids: [], bundleIds: [] },
      nowMs: idleStart + DETECTION_SESSION_RESET_MS,
      micActiveSinceMs: null,
      lastIdleAtMs: idleStart,
      promptedThisSession: true,
      suppress: false,
    })
    expect(result.decision.action).toBe('reset_session')
    expect(result.promptedThisSession).toBe(false)
  })
})
