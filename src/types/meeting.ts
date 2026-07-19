export type MeetingStatus = 'draft' | 'live' | 'processing' | 'ready' | 'error'

export type TranscriptEntry = {
  id: string
  text: string
  source: 'mic' | 'system'
  speaker: string
  at: number
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
  enhancedNotes?: string
  summary?: string
  actionItems?: string[]
  enhanceError?: string
}

export type ConnectionStatus = {
  paired: boolean
  email?: string
  plan?: string
  planLabel?: string
}

export type RecordingState = 'idle' | 'recording' | 'paused'
