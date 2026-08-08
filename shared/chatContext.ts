/**
 * Pack recent meetings into a capped context string for Ask AI across meetings.
 */

export type MeetingChatContext = {
  id: string
  title: string
  summary?: string
  enhancedNotes?: string
  userNotes?: string
  attendeeEmails?: string[]
  attendees?: Array<{ name?: string | null; email?: string; company?: string }>
  folderIds?: string[]
  startedAt?: number
  createdAt: number
}

const DEFAULT_BUDGET = 12_000
const MAX_MEETINGS = 12

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2)
}

function meetingText(meeting: MeetingChatContext): string {
  return [
    meeting.title,
    meeting.enhancedNotes,
    meeting.summary,
    meeting.userNotes,
    ...(meeting.attendeeEmails ?? []),
    ...(meeting.attendees ?? []).flatMap((person) => [person.name, person.email, person.company]),
  ]
    .filter(Boolean)
    .join('\n')
}

function relevanceScore(meeting: MeetingChatContext, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0
  const haystack = meetingText(meeting).toLowerCase()
  let score = 0
  for (const token of queryTokens) {
    if (haystack.includes(token)) score += token.length >= 6 ? 2 : 1
  }
  return score
}

export function selectMeetingsForQuery(
  meetings: MeetingChatContext[],
  query: string,
  limit = MAX_MEETINGS,
): MeetingChatContext[] {
  const queryTokens = tokenize(query)
  const ranked = [...meetings].map((meeting) => ({
    meeting,
    score: relevanceScore(meeting, queryTokens),
    recency: meeting.startedAt ?? meeting.createdAt,
  }))

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.recency - a.recency
  })

  return ranked.slice(0, Math.max(1, limit)).map((entry) => entry.meeting)
}

export function packMeetingsForChat(
  meetings: MeetingChatContext[],
  query = '',
  budgetChars = DEFAULT_BUDGET,
): string {
  const picked = selectMeetingsForQuery(meetings, query, MAX_MEETINGS)
  const sorted = [...picked].sort((a, b) => (b.startedAt ?? b.createdAt) - (a.startedAt ?? a.createdAt))

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
    'You have context from multiple Clarifi meetings. Answer from this context only and cite meeting titles.',
    '',
    chunks.join('\n\n'),
  ].join('\n')
}
