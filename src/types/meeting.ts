export type MeetingStatus = 'draft' | 'live' | 'processing' | 'ready' | 'error'

export type TranscriptEntry = {
  id: string
  text: string
  source: 'mic' | 'system'
  speaker: string
  at: number
}

export type SpeakerLabels = Record<string, string>

export type Folder = {
  id: string
  name: string
  createdAt: number
  sortOrder: number
}

export type Meeting = {
  id: string
  title: string
  createdAt: number
  startedAt?: number
  endedAt?: number
  status: MeetingStatus
  userNotes: string
  transcript: TranscriptEntry[]
  speakerLabels?: SpeakerLabels
  calendarEventId?: string
  calendarProvider?: 'google' | 'microsoft'
  scheduledStart?: number
  attendeeEmails?: string[]
  folderIds?: string[]
  enhancedNotes?: string
  summary?: string
  actionItems?: string[]
  completedActionItems?: string[]
  enhanceError?: string
}

export type ConnectionStatus = {
  paired: boolean
  email?: string
  plan?: string
  planLabel?: string
}

export type RecordingState = 'idle' | 'recording' | 'paused'
