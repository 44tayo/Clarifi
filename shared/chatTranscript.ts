/**
 * Prefer live session transcript while a meeting is actively recording.
 */

export type ChatTranscriptEntry = {
  id: string
  text: string
  source: 'mic' | 'system'
  speaker: string
  at: number
  audioStartMs?: number
  audioEndMs?: number
}

export function resolveTranscriptEntriesForChat(input: {
  meetingId: string
  activeMeetingId: string | null | undefined
  sessionEntries: ChatTranscriptEntry[]
  storedEntries: ChatTranscriptEntry[]
}): ChatTranscriptEntry[] {
  const { meetingId, activeMeetingId, sessionEntries, storedEntries } = input
  if (
    activeMeetingId &&
    meetingId === activeMeetingId &&
    Array.isArray(sessionEntries) &&
    sessionEntries.length > 0
  ) {
    return sessionEntries
  }
  return Array.isArray(storedEntries) ? storedEntries : []
}

export function transcriptEntriesToChatLines(
  entries: ChatTranscriptEntry[],
  resolveSpeaker: (speaker: string) => string = (speaker) => speaker,
): string[] {
  return entries.map((entry) => `${resolveSpeaker(entry.speaker)}: ${entry.text}`)
}
