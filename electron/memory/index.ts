export { closeMemoryDatabase, getMemoryDbPath, getMemoryDirectory, openMemoryDatabase } from './db'
export { initializeMemoryDatabase, runMemoryMigrations } from './migrate'
export { MemoryService } from './MemoryService'
export {
  clearAllSessionsFromMemory,
  clearAudioSessionsFromMemory,
  clearChatSessionsFromMemory,
  deleteAudioSessionFromMemory,
  deleteChatSessionFromMemory,
  importLegacySessionsIfNeeded,
  syncAudioSessionToMemory,
  syncChatSessionToMemory,
} from './sessionSync'
export { getMemoryContextForPrompt, handleMemoryIpc } from './memoryHandlers'
export type {
  ActionItemRecord,
  CreateMemorySessionInput,
  DailyBriefingRecord,
  KnowledgeCategory,
  KnowledgeFact,
  MemorySession,
  MemorySessionStatus,
  MemorySessionType,
  MemorySettings,
  PersonRecord,
  PreSessionContext,
  RelationshipCard,
  SessionInteractionInput,
  SessionSummaryRecord,
  SessionTranscriptChunkInput,
  UpdateMemorySettingsInput,
  UpdateUserProfileInput,
  UpsertKnowledgeFactInput,
  UpsertMemorySessionInput,
  UserProfile,
} from './types'

import { maybeGenerateDailyBriefingOnLaunch } from './briefingService'
import { applyRetentionPolicy } from './exportService'
import { MemoryService } from './MemoryService'
import { importLegacySessionsIfNeeded } from './sessionSync'

export function initializeMemory(): void {
  MemoryService.initialize()
  importLegacySessionsIfNeeded()
  applyRetentionPolicy()
  void maybeGenerateDailyBriefingOnLaunch()
}
