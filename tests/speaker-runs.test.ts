import { describe, expect, it } from 'vitest'

import {
  SPEAKER_CHANGE_GAP_MS,
  splitWordsIntoSpeakerRuns,
} from '../shared/speakerRuns'

describe('splitWordsIntoSpeakerRuns', () => {
  it('starts a new speaker immediately after a pause (turn-taking)', () => {
    const runs = splitWordsIntoSpeakerRuns([
      { token: 'Hello', speaker: 0, startMs: 0, endMs: 200 },
      { token: 'team.', speaker: 0, startMs: 220, endMs: 500 },
      // Gap > SPEAKER_CHANGE_GAP_MS — new talker, even one word
      {
        token: 'Yep.',
        speaker: 1,
        startMs: 500 + SPEAKER_CHANGE_GAP_MS + 50,
        endMs: 500 + SPEAKER_CHANGE_GAP_MS + 250,
      },
      {
        token: 'Agreed.',
        speaker: 1,
        startMs: 500 + SPEAKER_CHANGE_GAP_MS + 280,
        endMs: 500 + SPEAKER_CHANGE_GAP_MS + 600,
      },
    ])
    expect(runs).toHaveLength(2)
    expect(runs[0]?.speakerIndex).toBe(0)
    expect(runs[0]?.text).toContain('Hello')
    expect(runs[1]?.speakerIndex).toBe(1)
    expect(runs[1]?.text).toMatch(/Yep/)
  })

  it('debounces a single-word blip inside continuous speech', () => {
    const runs = splitWordsIntoSpeakerRuns([
      { token: 'We', speaker: 0, startMs: 0, endMs: 100 },
      { token: 'should', speaker: 0, startMs: 110, endMs: 250 },
      { token: 'ship', speaker: 1, startMs: 260, endMs: 400 }, // blip
      { token: 'this', speaker: 0, startMs: 410, endMs: 550 },
      { token: 'week.', speaker: 0, startMs: 560, endMs: 700 },
    ])
    expect(runs).toHaveLength(1)
    expect(runs[0]?.speakerIndex).toBe(0)
    expect(runs[0]?.text).toContain('ship')
    expect(runs[0]?.text).toContain('week')
  })

  it('commits a speaker change after two consecutive words without a long gap', () => {
    const runs = splitWordsIntoSpeakerRuns([
      { token: 'Opening', speaker: 0, startMs: 0, endMs: 200 },
      { token: 'remarks.', speaker: 0, startMs: 210, endMs: 400 },
      { token: 'Quick', speaker: 1, startMs: 420, endMs: 550 },
      { token: 'question.', speaker: 1, startMs: 560, endMs: 800 },
    ])
    expect(runs).toHaveLength(2)
    expect(runs[0]?.speakerIndex).toBe(0)
    expect(runs[1]?.speakerIndex).toBe(1)
    expect(runs[1]?.text).toBe('Quick question.')
  })
})
