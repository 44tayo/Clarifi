import { describe, expect, it } from 'vitest'

import { buildChatMetricEvent, formatChatMetricLog } from '../shared/chatMetrics'
import { parseJsonChatReply } from '../shared/chatStream'

/** Fixed eval set with mock LLM replies (CI smoke). */
const EVAL_CASES = [
  {
    id: 'pricing',
    query: 'What pricing decision did we make?',
    mockRaw: '{"reply":"Raise enterprise pricing 8%.","citations":[{"meetingId":"pricing","title":"Q3 Pricing"}]}',
    expectMeetingId: 'pricing',
  },
  {
    id: 'hiring',
    query: 'Who are we hiring?',
    mockRaw: '{"reply":"Two senior backend engineers.","citations":[{"meetingId":"hiring","title":"Hiring Sync"}]}',
    expectMeetingId: 'hiring',
  },
  {
    id: 'no-evidence',
    query: 'What color is the logo?',
    mockRaw: '{"reply":"I do not see that in your notes.","citations":[]}',
    expectMeetingId: null,
  },
] as const

describe('chat metrics', () => {
  it('logs structured latency fields without message bodies', () => {
    const event = buildChatMetricEvent({
      scope: 'all',
      startedAt: 1000,
      firstTokenAt: 1120,
      finishedAt: 1800,
      citationCount: 2,
      retrievalHitIds: ['m1', 'm2'],
      streamed: true,
      ok: true,
    })
    const line = formatChatMetricLog(event)
    expect(line).toContain('chat_metric')
    expect(line).toContain('"firstTokenMs":120')
    expect(line).toContain('"completionMs":800')
    expect(line).not.toContain('Raise enterprise')
  })
})

describe('chat eval smoke (mock LLM)', () => {
  it('parses mock replies and citation expectations', () => {
    for (const testCase of EVAL_CASES) {
      const parsed = parseJsonChatReply(testCase.mockRaw)
      expect(parsed).not.toBeNull()
      expect(parsed!.reply.length).toBeGreaterThan(0)
      if (testCase.expectMeetingId) {
        expect(parsed!.citations.some((c) => c.meetingId === testCase.expectMeetingId)).toBe(true)
      } else {
        expect(parsed!.citations).toEqual([])
      }
    }
  })
})
