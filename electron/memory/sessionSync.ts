import { loadAudioSessions, type StoredAudioSession } from '../audioSessionHistory'
import { loadChatSessions, type ChatSession } from '../chatHistory'
import type { SessionRecap } from '../llm'
import type { TranscriptEntry } from '../transcriptUtils'
import { openMemoryDatabase } from './db'
import { MemoryService } from './MemoryService'
import { queueSummarizationAfterSync } from './sessionSummarizer'
import type { SessionInteractionInput, SessionTranscriptChunkInput } from './types'

function logSyncError(label: string, err: unknown): void {
  console.error(`[memory] ${label}:`, err)
}

function buildSearchText(parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join('\n')
    .slice(0, 8000)
}

function chatInteractions(session: ChatSession): SessionInteractionInput[] {
  const base = session.createdAt
  return session.messages.map((message, index) => ({
    type: 'message',
    role: message.role,
    content: message.content,
    metadata: message.usedScreen ? { usedScreen: true } : null,
    createdAt: base + index,
  }))
}

function audioChatInteractions(
  session: StoredAudioSession,
): SessionInteractionInput[] {
  const base = session.endedAt
  return session.chatMessages.map((message, index) => ({
    type: 'message',
    role: message.role,
    content: message.content,
    metadata: null,
    createdAt: base + index,
  }))
}

function audioTranscriptChunks(
  session: StoredAudioSession,
): SessionTranscriptChunkInput[] {
  const startedAt = session.createdAt
  return session.transcript.map((entry, index) => ({
    id: entry.id,
    seq: index,
    speaker: resolveSpeakerLabel(entry, session.speakerLabels),
    text: entry.text,
    atMs: Math.max(0, entry.at - startedAt),
    source: entry.source,
  }))
}

function resolveSpeakerLabel(
  entry: TranscriptEntry,
  speakerLabels?: Record<string, string>,
): string {
  if (speakerLabels?.[entry.speaker]) return speakerLabels[entry.speaker]
  return entry.speaker
}

function recapSearchText(recap: SessionRecap | null | undefined): string {
  if (!recap) return ''
  return [
    recap.summary,
    ...recap.discussionPoints,
    ...recap.highlights,
    ...recap.actionItems,
    ...recap.decisions,
    ...recap.openQuestions,
  ].join('\n')
}

export function syncChatSessionToMemory(session: ChatSession): void {
  try {
    if (session.messages.length === 0) return

    const searchText = buildSearchText([
      session.title,
      ...session.messages.map((m) => `${m.role}: ${m.content}`),
    ])

    MemoryService.upsertSessionSync({
      id: session.id,
      type: 'chat',
      title: session.title,
      startedAt: session.createdAt,
      endedAt: session.archived ? Date.now() : null,
      status: session.archived ? 'completed' : 'active',
      metadata: {
        archived: Boolean(session.archived),
        legacySource: 'chat-history',
      },
      searchText,
    })

    MemoryService.replaceInteractionsSync(session.id, chatInteractions(session))
    queueSummarizationAfterSync(session.id, {
      completed: Boolean(session.archived),
      contentCount: session.messages.length,
    })
  } catch (err) {
    logSyncError(`failed to sync chat session ${session.id}`, err)
  }
}

export function syncAudioSessionToMemory(session: StoredAudioSession): void {
  try {
    const searchText = buildSearchText([
      session.title,
      recapSearchText(session.recap),
      ...session.transcript.map((e) => `${resolveSpeakerLabel(e, session.speakerLabels)}: ${e.text}`),
      ...session.chatMessages.map((m) => `${m.role}: ${m.content}`),
    ])

    MemoryService.upsertSessionSync({
      id: session.id,
      type: 'live_call',
      title: session.title,
      startedAt: session.createdAt,
      endedAt: session.endedAt,
      status: 'completed',
      metadata: {
        recap: session.recap,
        speakerLabels: session.speakerLabels ?? null,
        legacySource: 'audio-sessions-history',
      },
      searchText,
    })

    MemoryService.replaceTranscriptChunksSync(session.id, audioTranscriptChunks(session))
    MemoryService.replaceInteractionsSync(session.id, audioChatInteractions(session))
    queueSummarizationAfterSync(session.id, {
      completed: true,
      contentCount: session.transcript.length + session.chatMessages.length,
    })
  } catch (err) {
    logSyncError(`failed to sync audio session ${session.id}`, err)
  }
}

export function deleteChatSessionFromMemory(id: string): void {
  try {
    MemoryService.deleteSessionSync(id)
  } catch (err) {
    logSyncError(`failed to delete chat session ${id}`, err)
  }
}

export function deleteAudioSessionFromMemory(id: string): void {
  try {
    MemoryService.deleteSessionSync(id)
  } catch (err) {
    logSyncError(`failed to delete audio session ${id}`, err)
  }
}

export function clearChatSessionsFromMemory(): void {
  try {
    MemoryService.deleteSessionsByTypeSync('chat')
  } catch (err) {
    logSyncError('failed to clear chat sessions', err)
  }
}

export function clearAudioSessionsFromMemory(): void {
  try {
    MemoryService.deleteSessionsByTypeSync('live_call')
  } catch (err) {
    logSyncError('failed to clear audio sessions', err)
  }
}

export function clearAllSessionsFromMemory(): void {
  try {
    MemoryService.clearAllSessionsSync()
  } catch (err) {
    logSyncError('failed to clear all memory sessions', err)
  }
}

export function importLegacySessionsIfNeeded(): void {
  try {
    const db = openMemoryDatabase()
    const row = db.prepare('SELECT COUNT(*) AS count FROM memory_sessions').get() as {
      count: number
    }
    if (row.count > 0) return

    const chatSessions = loadChatSessions()
    const audioSessions = loadAudioSessions()
    if (chatSessions.length === 0 && audioSessions.length === 0) return

    console.log(
      `[memory] importing ${chatSessions.length} chat and ${audioSessions.length} audio sessions from legacy JSON`,
    )

    for (const session of chatSessions) {
      syncChatSessionToMemory(session)
    }
    for (const session of audioSessions) {
      syncAudioSessionToMemory(session)
    }

    for (const session of chatSessions) {
      queueSummarizationAfterSync(session.id, {
        completed: Boolean(session.archived),
        contentCount: session.messages.length,
      })
    }
    for (const session of audioSessions) {
      queueSummarizationAfterSync(session.id, {
        completed: true,
        contentCount: session.transcript.length,
      })
    }

    console.log('[memory] legacy session import complete')
  } catch (err) {
    logSyncError('legacy session import failed', err)
  }
}
