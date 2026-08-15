/**
 * Split word-level diarization into speaker runs.
 *
 * Peer bar (Jamie / Otter): short pauses between talkers must create a new
 * speaker turn — even on a single word ("Yep", "Okay"). Within continuous
 * speech, single-word index blips are folded back (Deepgram noise).
 */

export type TimedSpeakerWord = {
  token: string
  speaker: number
  startMs?: number
  endMs?: number
}

export type SpeakerRun = {
  speakerIndex: number
  text: string
  startMs?: number
  endMs?: number
}

/** Pause long enough to trust an immediate speaker change (turn-taking). */
export const SPEAKER_CHANGE_GAP_MS = 350

/** Within continuous speech, require this many consecutive words before flipping. */
export const SPEAKER_CHANGE_DEBOUNCE_WORDS = 2

function joinTokens(tokens: string[]): string {
  return tokens.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Build contiguous speaker runs from Deepgram-style word labels.
 * Prefers gap-based turn detection so a new talker after a pause is not
 * absorbed into the previous speaker.
 */
export function splitWordsIntoSpeakerRuns(words: TimedSpeakerWord[]): SpeakerRun[] {
  const usable = words.filter((word) => word.token.trim().length > 0)
  if (usable.length === 0) return []

  const runs: SpeakerRun[] = []
  let currentIndex = usable[0]!.speaker
  let parts: string[] = [usable[0]!.token]
  let runStart = usable[0]!.startMs
  let runEnd = usable[0]!.endMs
  let lastEnd = usable[0]!.endMs ?? usable[0]!.startMs

  let pendingIndex: number | null = null
  let pendingTokens: string[] = []
  let pendingStart: number | undefined
  let pendingEnd: number | undefined

  const flushCurrent = () => {
    const text = joinTokens(parts)
    if (!text) return
    runs.push({
      speakerIndex: currentIndex,
      text,
      startMs: runStart,
      endMs: runEnd,
    })
  }

  const foldPendingIntoCurrent = () => {
    if (pendingTokens.length === 0) return
    parts.push(...pendingTokens)
    if (typeof pendingEnd === 'number') runEnd = pendingEnd
    pendingIndex = null
    pendingTokens = []
    pendingStart = undefined
    pendingEnd = undefined
  }

  const commitPending = () => {
    flushCurrent()
    parts = pendingTokens
    currentIndex = pendingIndex!
    runStart = pendingStart
    runEnd = pendingEnd
    pendingIndex = null
    pendingTokens = []
    pendingStart = undefined
    pendingEnd = undefined
  }

  const startNewRun = (word: TimedSpeakerWord) => {
    flushCurrent()
    currentIndex = word.speaker
    parts = [word.token]
    runStart = word.startMs
    runEnd = word.endMs
    pendingIndex = null
    pendingTokens = []
    pendingStart = undefined
    pendingEnd = undefined
  }

  for (let i = 1; i < usable.length; i += 1) {
    const word = usable[i]!
    const gapMs =
      typeof word.startMs === 'number' && typeof lastEnd === 'number'
        ? word.startMs - lastEnd
        : 0

    if (word.speaker === currentIndex) {
      foldPendingIntoCurrent()
      parts.push(word.token)
      if (typeof word.endMs === 'number') runEnd = word.endMs
      lastEnd = word.endMs ?? word.startMs ?? lastEnd
      continue
    }

    // After a real pause, trust the new speaker immediately (Jamie-style turns).
    if (gapMs >= SPEAKER_CHANGE_GAP_MS) {
      foldPendingIntoCurrent()
      startNewRun(word)
      lastEnd = word.endMs ?? word.startMs ?? lastEnd
      continue
    }

    if (pendingIndex === word.speaker) {
      pendingTokens.push(word.token)
      pendingEnd = word.endMs
      if (pendingTokens.length >= SPEAKER_CHANGE_DEBOUNCE_WORDS) {
        commitPending()
      }
      lastEnd = word.endMs ?? word.startMs ?? lastEnd
      continue
    }

    foldPendingIntoCurrent()
    pendingIndex = word.speaker
    pendingTokens = [word.token]
    pendingStart = word.startMs
    pendingEnd = word.endMs
    lastEnd = word.endMs ?? word.startMs ?? lastEnd
  }

  // Trailing unconfirmed blip stays with the current speaker.
  foldPendingIntoCurrent()
  if (parts.length > 0) flushCurrent()
  return runs
}
