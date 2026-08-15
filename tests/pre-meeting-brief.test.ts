import { describe, expect, it } from 'vitest'

import { assemblePreMeetingBrief } from '../shared/preMeetingBrief'

const NOW = Date.UTC(2026, 7, 4)

describe('assemblePreMeetingBrief', () => {
  it('yields decisions/open actions with citations from attendee history', () => {
    const brief = assemblePreMeetingBrief({
      now: NOW,
      event: {
        id: 'evt1',
        title: 'Acme renewal check-in',
        startAt: new Date(NOW + 3600_000).toISOString(),
        attendeeEmails: ['maya@acme.com'],
      },
      meetings: [
        {
          id: 'm-prior',
          title: 'Acme pricing workshop',
          attendeeEmails: ['maya@acme.com', 'jon@acme.com'],
          enhancedNotes:
            'Decision: keep enterprise discount floor at 15%.\nAction: Maya to send renewal proposal by Friday.\nNext step: confirm legal redlines.',
          createdAt: NOW - 5 * 86400000,
          startedAt: NOW - 5 * 86400000,
        },
        {
          id: 'm-other',
          title: 'Internal hiring sync',
          attendeeEmails: ['hr@clarifi.app'],
          enhancedNotes: 'Hiring two backend engineers. Unrelated to Acme.',
          createdAt: NOW - 2 * 86400000,
          startedAt: NOW - 2 * 86400000,
        },
      ],
    })

    expect(brief.attendeeEmails).toContain('maya@acme.com')
    expect(brief.decisions.some((line) => /discount|decision/i.test(line))).toBe(true)
    expect(brief.openActions.some((line) => /maya|proposal|action|next step/i.test(line))).toBe(
      true,
    )
    expect(brief.citations.some((citation) => citation.meetingId === 'm-prior')).toBe(true)
    expect(brief.suggestedQuestions.length).toBeGreaterThanOrEqual(5)
  })
})
