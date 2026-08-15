export type MeetingStatus = 'draft' | 'live' | 'processing' | 'ready' | 'error'

export type TranscriptEntry = {
  id: string
  text: string
  source: 'mic' | 'system'
  speaker: string
  at: number
  audioStartMs?: number
  audioEndMs?: number
}

export type SpeakerLabels = Record<string, string>

export type {
  MeetingAttendee,
  SpeakerIdentities,
  SpeakerIdentity,
  SpeakerIdentitySource,
} from '../../shared/speakers'
export type { MeetingTemplateId } from '../../shared/meetingTemplates'

import type { MeetingTemplateId } from '../../shared/meetingTemplates'
import type { MeetingAttendee, SpeakerIdentities } from '../../shared/speakers'

export type Folder = {
  id: string
  name: string
  createdAt: number
  sortOrder: number
  color: string
  icon: string
  parentId: string | null
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
  /** Rich identity map (name + optional email). speakerLabels stays in sync for legacy readers. */
  speakerIdentities?: SpeakerIdentities
  calendarEventId?: string
  calendarProvider?: 'google' | 'microsoft'
  scheduledStart?: number
  attendeeEmails?: string[]
  /** Structured calendar participants (preferred over emails-only). */
  attendees?: MeetingAttendee[]
  folderIds?: string[]
  tags?: string[]
  templateId?: MeetingTemplateId
  enhancedNotes?: string
  summary?: string
  actionItems?: string[]
  completedActionItems?: string[]
  /** Claim text → cached TRANSCRIPT SUMMARY from on-click eyeglass. */
  evidenceCache?: Record<string, string>
  enhanceError?: string
  /** Relative path under userData for local system-audio recording (snippet replay). */
  recordingPath?: string
}

export type ConnectionStatus = {
  paired: boolean
  email?: string
  plan?: string
  planLabel?: string
  /** ISO timestamp when the Stripe 30-day trial ends (if active). */
  trialEndsAt?: string | null
  subscriptionStatus?: string | null
  trialActive?: boolean
}

export type RecordingState = 'idle' | 'recording' | 'paused'
