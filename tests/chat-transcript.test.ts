import { describe, expect, it } from 'vitest'

import {
  resolveTranscriptEntriesForChat,
  transcriptEntriesToChatLines,
} from '../shared/chatTranscript'

const stored = [
  {
    id: 's1',
    text: 'Stored only',
    source: 'system' as const,
    speaker: 'Speaker 1',
    at: 1,
  },
]

const live = [
  {
    id: 'l1',
    text: 'Live catch-up line',
    source: 'mic' as const,
    speaker: 'Me',
    at: 2,
  },
  {
    id: 'l2',
    text: 'Latest remote utterance',
    source: 'system' as const,
    speaker: 'Speaker 2',
    at: 3,
  },
]

describe('resolveTranscriptEntriesForChat', () => {
  it('prefers live session entries when meeting is active', () => {
    const entries = resolveTranscriptEntriesForChat({
      meetingId: 'm1',
      activeMeetingId: 'm1',
      sessionEntries: live,
      storedEntries: stored,
    })
    expect(entries.map((e) => e.id)).toEqual(['l1', 'l2'])
  })

  it('falls back to stored transcript when not the active meeting', () => {
    const entries = resolveTranscriptEntriesForChat({
      meetingId: 'm1',
      activeMeetingId: 'm2',
      sessionEntries: live,
      storedEntries: stored,
    })
    expect(entries).toEqual(stored)
  })

  it('falls back to stored when live session is empty', () => {
    const entries = resolveTranscriptEntriesForChat({
      meetingId: 'm1',
      activeMeetingId: 'm1',
      sessionEntries: [],
      storedEntries: stored,
    })
    expect(entries).toEqual(stored)
  })
})

describe('transcriptEntriesToChatLines', () => {
  it('formats speaker display lines', () => {
    const lines = transcriptEntriesToChatLines(live, (speaker) =>
      speaker === 'Me' ? 'Tayo' : speaker,
    )
    expect(lines[0]).toBe('Tayo: Live catch-up line')
    expect(lines[1]).toBe('Speaker 2: Latest remote utterance')
  })
})
