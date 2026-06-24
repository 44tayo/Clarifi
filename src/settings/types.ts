export type SettingsTab =
  | 'profile'
  | 'community'
  | 'models'
  | 'modes'
  | 'integrations'
  | 'keybinds'
  | 'audio'
  | 'audio_sessions'
  | 'history'
  | 'productivity'

export const SETTINGS_TABS: SettingsTab[] = [
  'profile',
  'community',
  'models',
  'modes',
  'integrations',
  'keybinds',
  'audio',
  'audio_sessions',
  'history',
  'productivity',
]

export type DeviceProfile = {
  paired: boolean
  userId?: string
  email?: string
  firstName?: string
  lastName?: string
  fullName?: string
  avatarUrl?: string
  localAvatarUrl?: string
  connectedAccounts?: Array<{ provider: string; label: string; email?: string }>
  plan?: string
  planLabel?: string
  entitlements?: string[]
  sessionsToday?: number
  sessionsLimit?: number | null
}

export type StoredAudioSession = {
  id: string
  title: string
  createdAt: number
  endedAt: number
  transcript: Array<{ id: string; text: string; source: string; speaker?: string; at: number }>
  recap: {
    summary: string
    highlights: string[]
    actionItems: string[]
    openQuestions: string[]
    recapEmailDraft: string
  } | null
  chatMessages: Array<{ role: string; content: string }>
}

export type ChatSession = {
  id: string
  title: string
  createdAt: number
  messages: { role: string; content: string }[]
  archived?: boolean
}

export type HistoryFilter = 'all' | 'active' | 'archived'

export type CommunitySummary = {
  id: string
  name: string
  role: 'owner' | 'member'
  memberCount: number
}

export type CommunityFolder = {
  id: string
  communityId: string
  parentId: string | null
  name: string
  sortOrder: number
}

export type CommunityItem = {
  id: string
  communityId: string
  folderId: string | null
  type: 'meeting_recap' | 'transcript' | 'note'
  title: string
  content: unknown
  sourceSessionId: string | null
  sharedBy: string
  createdAt: string
}

export type CommunityInvite = {
  id: string
  communityId: string
  communityName: string
  email: string
  status: string
  token: string
}
