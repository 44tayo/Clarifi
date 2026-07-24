/**
 * Pack recent meetings into a capped context string for Ask AI across meetings.
 */

export type MeetingChatContext = {
  id: string
  title: string
  summary?: string
  enhancedNotes?: string
  userNotes?: string
  startedAt?: number
  createdAt: number
}

const DEFAULT_BUDGET = 12_000

export function packMeetingsForChat(
  meetings: MeetingChatContext[],
  budgetChars = DEFAULT_BUDGET,
): string {
  const sorted = [...meetings].sort(
    (a, b) => (b.startedAt ?? b.createdAt) - (a.startedAt ?? a.createdAt),
  )

  const chunks: string[] = []
  let used = 0

  for (const meeting of sorted) {
    const body =
      (meeting.enhancedNotes?.trim() || meeting.summary?.trim() || meeting.userNotes?.trim() || '')
        .slice(0, 1800)
    const block = [
      `### ${meeting.title || 'Untitled meeting'}`,
      body || '(No notes yet)',
    ].join('\n')

    if (used + block.length > budgetChars && chunks.length > 0) break
    chunks.push(block)
    used += block.length + 2
  }

  if (chunks.length === 0) return ''
  return [
    'You have context from multiple Clarifi meetings. Cite meeting titles when answering.',
    '',
    chunks.join('\n\n'),
  ].join('\n')
}
