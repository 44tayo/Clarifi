export type KnowledgeCategory = 'profile' | 'work' | 'relationships' | 'preferences'
export type FactSource = 'explicit' | 'inferred' | 'manual'
export type MemorySessionType = 'live_call' | 'chat' | 'audio_recording'
export type MemorySessionStatus = 'active' | 'completed' | 'failed'

export type MemorySettings = {
  retentionDays: number
  dailyBriefingEnabled: boolean
  dailyBriefingTime: string
  crossSessionContext: boolean
  relationshipCards: boolean
  adaptiveLearning: boolean
  calendarSyncEnabled: boolean
  lastBriefingGeneratedAt: number | null
  updatedAt: number
}

export type UserProfile = {
  name: string | null
  role: string | null
  company: string | null
  industry: string | null
  tools: string[]
  communicationStyle: string | null
  preferenceProfile: Record<string, unknown> | null
  updatedAt: number
}

export type KnowledgeFact = {
  id: string
  category: KnowledgeCategory
  key: string | null
  value: string
  source: FactSource
  confidence: number
  sessionId: string | null
  personId: string | null
  createdAt: number
  updatedAt: number
}

export type MemorySession = {
  id: string
  type: MemorySessionType
  title: string | null
  platform: string | null
  startedAt: number
  endedAt: number | null
  durationMs: number | null
  status: MemorySessionStatus
  metadata: Record<string, unknown> | null
  searchText: string | null
  createdAt: number
  updatedAt: number
}

export type UpsertKnowledgeFactInput = {
  id?: string
  category: KnowledgeCategory
  key?: string | null
  value: string
  source: FactSource
  confidence?: number
  sessionId?: string | null
  personId?: string | null
}

export type CreateMemorySessionInput = {
  id?: string
  type: MemorySessionType
  title?: string | null
  platform?: string | null
  metadata?: Record<string, unknown> | null
  searchText?: string | null
}

export type UpdateMemorySettingsInput = Partial<
  Omit<MemorySettings, 'updatedAt'>
>

export type UpdateUserProfileInput = Partial<
  Omit<UserProfile, 'updatedAt' | 'tools' | 'preferenceProfile'>
> & {
  tools?: string[]
  preferenceProfile?: Record<string, unknown> | null
}

export type SessionTranscriptChunkInput = {
  id?: string
  seq: number
  speaker?: string | null
  text: string
  atMs: number
  source?: string | null
}

export type SessionInteractionInput = {
  id?: string
  type: string
  role?: string | null
  content: string
  metadata?: Record<string, unknown> | null
  createdAt: number
}

export type UpsertMemorySessionInput = {
  id: string
  type: MemorySessionType
  title?: string | null
  platform?: string | null
  startedAt: number
  endedAt?: number | null
  status: MemorySessionStatus
  metadata?: Record<string, unknown> | null
  searchText?: string | null
}

export type SessionSummaryRecord = {
  sessionId: string
  summary: string
  topics: string[]
  decisions: string[]
  actionItems: string[]
  factsLearned: Array<{ category: KnowledgeCategory; key?: string | null; value: string }>
  model: string | null
  generatedAt: number
}

export type PersonRecord = {
  id: string
  name: string
  normalizedName: string
  company: string | null
  role: string | null
  email: string | null
  notes: string | null
  sentimentHint: string | null
  firstSeenAt: number
  lastSeenAt: number
  interactionCount: number
  metadata: Record<string, unknown> | null
}

export type UpsertPersonInput = {
  id?: string
  name: string
  company?: string | null
  role?: string | null
  email?: string | null
  notes?: string | null
  sentimentHint?: string | null
  metadata?: Record<string, unknown> | null
}

export type ActionItemRecord = {
  id: string
  sessionId: string | null
  personId: string | null
  text: string
  status: 'open' | 'completed' | 'cancelled'
  dueAt: number | null
  completedAt: number | null
  source: string
  createdAt: number
  updatedAt: number
}

export type DailyBriefingRecord = {
  id: string
  briefingDate: string
  contentMarkdown: string
  content: Record<string, unknown>
  calendar: Record<string, unknown> | null
  generatedAt: number
  dismissedAt: number | null
  pinned: boolean
}

export type RelationshipCard = {
  personId: string
  name: string
  company: string | null
  role: string | null
  lastInteractionSummary: string | null
  keyFacts: string[]
  sentimentHint: string | null
  interactionCount: number
}

export type PreSessionContext = {
  headline: string
  summaryLines: string[]
  relatedSessions: Array<{ id: string; title: string; summary: string; startedAt: number }>
  knownPeople: RelationshipCard[]
  openActionItems: string[]
}

export type MemoryExportBundle = {
  exportedAt: number
  settings: MemorySettings
  profile: UserProfile
  facts: KnowledgeFact[]
  sessions: MemorySession[]
  summaries: SessionSummaryRecord[]
  people: PersonRecord[]
  actionItems: ActionItemRecord[]
}

export type SuggestionFeedbackOutcome = 'accepted' | 'ignored' | 'edited'

export type RecordSuggestionFeedbackInput = {
  sessionId?: string | null
  interactionId?: string | null
  suggestionType: string
  originalText: string
  outcome: SuggestionFeedbackOutcome
  editedText?: string | null
}

export type LearningInsight = {
  id: string
  sessionCount: number
  insights: Record<string, unknown>
  appliedAt: number
}
