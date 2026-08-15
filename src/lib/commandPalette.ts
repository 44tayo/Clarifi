export type SearchableMeeting = {
  id: string
  title: string
  summary?: string
  userNotes?: string
  enhancedNotes?: string
  transcript?: Array<{ text: string }>
  startedAt?: number
  createdAt: number
}

export type CommandAction = {
  id: string
  label: string
  group: 'Navigation' | 'Meetings'
  keywords?: string
  meetingId?: string
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function haystack(meeting: SearchableMeeting): string {
  const transcriptText = (meeting.transcript ?? []).map((entry) => entry.text).join(' ')
  return normalize(
    [
      meeting.title,
      meeting.summary ?? '',
      meeting.userNotes ?? '',
      meeting.enhancedNotes ?? '',
      transcriptText,
    ].join(' '),
  )
}

/** Score higher for earlier title matches; 0 means no match. */
export function scoreMeeting(meeting: SearchableMeeting, query: string): number {
  const q = normalize(query)
  if (!q) return 1
  const title = normalize(meeting.title)
  if (title === q) return 100
  if (title.startsWith(q)) return 80
  if (title.includes(q)) return 60
  if (haystack(meeting).includes(q)) return 40
  const tokens = q.split(' ').filter(Boolean)
  if (tokens.length > 1 && tokens.every((t) => haystack(meeting).includes(t))) return 30
  return 0
}

export function searchMeetings<T extends SearchableMeeting>(
  meetings: T[],
  query: string,
  limit = 8,
): T[] {
  const q = normalize(query)
  if (!q) {
    return [...meetings]
      .sort((a, b) => (b.startedAt ?? b.createdAt) - (a.startedAt ?? a.createdAt))
      .slice(0, limit)
  }

  return meetings
    .map((meeting) => ({ meeting, score: scoreMeeting(meeting, q) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || (b.meeting.startedAt ?? b.meeting.createdAt) - (a.meeting.startedAt ?? a.meeting.createdAt))
    .slice(0, limit)
    .map((row) => row.meeting)
}

export function buildCommandActions(
  meetings: SearchableMeeting[],
  query: string,
): CommandAction[] {
  const q = normalize(query)
  const nav: CommandAction[] = [
    { id: 'nav-home', label: 'Go to Home', group: 'Navigation', keywords: 'home' },
    { id: 'nav-meetings', label: 'Go to Meetings', group: 'Navigation', keywords: 'meetings list' },
    { id: 'nav-chat', label: 'Go to Chat', group: 'Navigation', keywords: 'chat ask' },
    { id: 'nav-shared', label: 'Go to Shared with me', group: 'Navigation', keywords: 'shared inbox' },
    { id: 'nav-settings', label: 'Open Settings', group: 'Navigation', keywords: 'settings preferences theme' },
    { id: 'nav-new', label: 'Start meeting', group: 'Navigation', keywords: 'new record capture' },
  ]

  const filteredNav = q
    ? nav.filter((action) => {
        const blob = normalize(`${action.label} ${action.keywords ?? ''}`)
        return blob.includes(q) || q.split(' ').every((t) => blob.includes(t))
      })
    : nav

  const meetingActions: CommandAction[] = searchMeetings(meetings, query, 8).map((meeting) => ({
    id: `meeting-${meeting.id}`,
    label: meeting.title || 'Untitled meeting',
    group: 'Meetings',
    meetingId: meeting.id,
  }))

  return [...filteredNav, ...meetingActions]
}
