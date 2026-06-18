import { randomUUID } from 'crypto'
import { closeMemoryDatabase, openMemoryDatabase } from './db'
import { initializeMemoryDatabase } from './migrate'
import type {
  CreateMemorySessionInput,
  KnowledgeCategory,
  KnowledgeFact,
  MemorySession,
  MemorySessionType,
  MemorySettings,
  SessionInteractionInput,
  SessionTranscriptChunkInput,
  UpdateMemorySettingsInput,
  UpdateUserProfileInput,
  UpsertKnowledgeFactInput,
  UpsertMemorySessionInput,
  UserProfile,
} from './types'

function runAsync<T>(fn: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    setImmediate(() => {
      try {
        resolve(fn())
      } catch (error) {
        reject(error)
      }
    })
  })
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function mapSettings(row: Record<string, unknown>): MemorySettings {
  return {
    retentionDays: Number(row.retention_days),
    dailyBriefingEnabled: Boolean(row.daily_briefing_enabled),
    dailyBriefingTime: String(row.daily_briefing_time),
    crossSessionContext: Boolean(row.cross_session_context),
    relationshipCards: Boolean(row.relationship_cards),
    adaptiveLearning: Boolean(row.adaptive_learning),
    calendarSyncEnabled: Boolean(row.calendar_sync_enabled),
    lastBriefingGeneratedAt:
      row.last_briefing_generated_at == null ? null : Number(row.last_briefing_generated_at),
    updatedAt: Number(row.updated_at),
  }
}

function mapProfile(row: Record<string, unknown>): UserProfile {
  return {
    name: row.name == null ? null : String(row.name),
    role: row.role == null ? null : String(row.role),
    company: row.company == null ? null : String(row.company),
    industry: row.industry == null ? null : String(row.industry),
    tools: parseJsonArray(row.tools_json as string | null),
    communicationStyle:
      row.communication_style == null ? null : String(row.communication_style),
    preferenceProfile: parseJsonObject(row.preference_profile as string | null),
    updatedAt: Number(row.updated_at),
  }
}

function mapFact(row: Record<string, unknown>): KnowledgeFact {
  return {
    id: String(row.id),
    category: String(row.category) as KnowledgeCategory,
    key: row.key == null ? null : String(row.key),
    value: String(row.value),
    source: String(row.source) as KnowledgeFact['source'],
    confidence: Number(row.confidence),
    sessionId: row.session_id == null ? null : String(row.session_id),
    personId: row.person_id == null ? null : String(row.person_id),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }
}

function mapSession(row: Record<string, unknown>): MemorySession {
  return {
    id: String(row.id),
    type: String(row.type) as MemorySession['type'],
    title: row.title == null ? null : String(row.title),
    platform: row.platform == null ? null : String(row.platform),
    startedAt: Number(row.started_at),
    endedAt: row.ended_at == null ? null : Number(row.ended_at),
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
    status: String(row.status) as MemorySession['status'],
    metadata: parseJsonObject(row.metadata_json as string | null),
    searchText: row.search_text == null ? null : String(row.search_text),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }
}

function ensureDefaults(): void {
  const db = openMemoryDatabase()
  const now = Date.now()

  const settingsCount = db
    .prepare('SELECT COUNT(*) AS count FROM memory_settings WHERE id = 1')
    .get() as { count: number }
  if (settingsCount.count === 0) {
    db.prepare(
      `INSERT INTO memory_settings (
        id, retention_days, daily_briefing_enabled, daily_briefing_time,
        cross_session_context, relationship_cards, adaptive_learning,
        calendar_sync_enabled, last_briefing_generated_at, updated_at
      ) VALUES (1, 90, 1, '08:00', 1, 1, 1, 0, NULL, ?)`,
    ).run(now)
  }

  const profileCount = db
    .prepare('SELECT COUNT(*) AS count FROM user_profile WHERE id = 1')
    .get() as { count: number }
  if (profileCount.count === 0) {
    db.prepare(
      `INSERT INTO user_profile (
        id, name, role, company, industry, tools_json,
        communication_style, preference_profile, updated_at
      ) VALUES (1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?)`,
    ).run(now)
  }
}

export class MemoryService {
  static initialize(): void {
    initializeMemoryDatabase()
    ensureDefaults()
  }

  static close(): void {
    closeMemoryDatabase()
  }

  static getSettingsSync(): MemorySettings {
    const db = openMemoryDatabase()
    const row = db.prepare('SELECT * FROM memory_settings WHERE id = 1').get()
    if (!row) throw new Error('memory_settings row missing')
    return mapSettings(row as Record<string, unknown>)
  }

  static updateSettingsSync(input: UpdateMemorySettingsInput): MemorySettings {
    const current = MemoryService.getSettingsSync()
    const next = {
      ...current,
      ...input,
      updatedAt: Date.now(),
    }

    openMemoryDatabase()
      .prepare(
        `UPDATE memory_settings SET
          retention_days = ?,
          daily_briefing_enabled = ?,
          daily_briefing_time = ?,
          cross_session_context = ?,
          relationship_cards = ?,
          adaptive_learning = ?,
          calendar_sync_enabled = ?,
          last_briefing_generated_at = ?,
          updated_at = ?
        WHERE id = 1`,
      )
      .run(
        next.retentionDays,
        next.dailyBriefingEnabled ? 1 : 0,
        next.dailyBriefingTime,
        next.crossSessionContext ? 1 : 0,
        next.relationshipCards ? 1 : 0,
        next.adaptiveLearning ? 1 : 0,
        next.calendarSyncEnabled ? 1 : 0,
        next.lastBriefingGeneratedAt,
        next.updatedAt,
      )

    return next
  }

  static getUserProfileSync(): UserProfile {
    const db = openMemoryDatabase()
    const row = db.prepare('SELECT * FROM user_profile WHERE id = 1').get()
    if (!row) throw new Error('user_profile row missing')
    return mapProfile(row as Record<string, unknown>)
  }

  static updateUserProfileSync(input: UpdateUserProfileInput): UserProfile {
    const current = MemoryService.getUserProfileSync()
    const next: UserProfile = {
      ...current,
      ...input,
      tools: input.tools ?? current.tools,
      preferenceProfile: input.preferenceProfile ?? current.preferenceProfile,
      updatedAt: Date.now(),
    }

    openMemoryDatabase()
      .prepare(
        `UPDATE user_profile SET
          name = ?,
          role = ?,
          company = ?,
          industry = ?,
          tools_json = ?,
          communication_style = ?,
          preference_profile = ?,
          updated_at = ?
        WHERE id = 1`,
      )
      .run(
        next.name,
        next.role,
        next.company,
        next.industry,
        next.tools.length > 0 ? JSON.stringify(next.tools) : null,
        next.communicationStyle,
        next.preferenceProfile ? JSON.stringify(next.preferenceProfile) : null,
        next.updatedAt,
      )

    return next
  }

  static listFactsSync(category?: KnowledgeCategory): KnowledgeFact[] {
    const db = openMemoryDatabase()
    const rows = category
      ? db
          .prepare(
            `SELECT * FROM knowledge_facts
             WHERE is_deleted = 0 AND category = ?
             ORDER BY updated_at DESC`,
          )
          .all(category)
      : db
          .prepare(
            `SELECT * FROM knowledge_facts
             WHERE is_deleted = 0
             ORDER BY category ASC, updated_at DESC`,
          )
          .all()

    return rows.map((row) => mapFact(row as Record<string, unknown>))
  }

  static upsertFactSync(input: UpsertKnowledgeFactInput): KnowledgeFact {
    const db = openMemoryDatabase()
    const now = Date.now()
    const id = input.id ?? randomUUID()

    db.prepare(
      `INSERT INTO knowledge_facts (
        id, category, key, value, source, confidence,
        session_id, person_id, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        category = excluded.category,
        key = excluded.key,
        value = excluded.value,
        source = excluded.source,
        confidence = excluded.confidence,
        session_id = excluded.session_id,
        person_id = excluded.person_id,
        is_deleted = 0,
        updated_at = excluded.updated_at`,
    ).run(
      id,
      input.category,
      input.key ?? null,
      input.value,
      input.source,
      input.confidence ?? 1,
      input.sessionId ?? null,
      input.personId ?? null,
      now,
      now,
    )

    const row = db.prepare('SELECT * FROM knowledge_facts WHERE id = ?').get(id)
    if (!row) throw new Error('Failed to upsert knowledge fact')
    return mapFact(row as Record<string, unknown>)
  }

  static deleteFactSync(id: string): void {
    openMemoryDatabase()
      .prepare('UPDATE knowledge_facts SET is_deleted = 1, updated_at = ? WHERE id = ?')
      .run(Date.now(), id)
  }

  static createSessionSync(input: CreateMemorySessionInput): MemorySession {
    const db = openMemoryDatabase()
    const now = Date.now()
    const id = input.id ?? randomUUID()

    db.prepare(
      `INSERT INTO memory_sessions (
        id, type, title, platform, started_at, ended_at, duration_ms,
        status, metadata_json, search_text, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NULL, NULL, 'active', ?, ?, ?, ?)`,
    ).run(
      id,
      input.type,
      input.title ?? null,
      input.platform ?? null,
      now,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.searchText ?? null,
      now,
      now,
    )

    const row = db.prepare('SELECT * FROM memory_sessions WHERE id = ?').get(id)
    if (!row) throw new Error('Failed to create memory session')
    return mapSession(row as Record<string, unknown>)
  }

  static getSessionSync(id: string): MemorySession | null {
    const row = openMemoryDatabase().prepare('SELECT * FROM memory_sessions WHERE id = ?').get(id)
    return row ? mapSession(row as Record<string, unknown>) : null
  }

  static listSessionsSync(limit = 50): MemorySession[] {
    const rows = openMemoryDatabase()
      .prepare(
        `SELECT * FROM memory_sessions
         ORDER BY started_at DESC
         LIMIT ?`,
      )
      .all(limit)

    return rows.map((row) => mapSession(row as Record<string, unknown>))
  }

  static completeSessionSync(id: string, endedAt = Date.now()): MemorySession | null {
    const db = openMemoryDatabase()
    const existing = MemoryService.getSessionSync(id)
    if (!existing) return null

    const durationMs = Math.max(0, endedAt - existing.startedAt)
    db.prepare(
      `UPDATE memory_sessions SET
        ended_at = ?,
        duration_ms = ?,
        status = 'completed',
        updated_at = ?
      WHERE id = ?`,
    ).run(endedAt, durationMs, Date.now(), id)

    return MemoryService.getSessionSync(id)
  }

  static upsertSessionSync(input: UpsertMemorySessionInput): MemorySession {
    const db = openMemoryDatabase()
    const now = Date.now()
    const existing = MemoryService.getSessionSync(input.id)
    const endedAt = input.endedAt ?? null
    const durationMs =
      endedAt != null ? Math.max(0, endedAt - input.startedAt) : null

    if (existing) {
      db.prepare(
        `UPDATE memory_sessions SET
          type = ?,
          title = ?,
          platform = ?,
          started_at = ?,
          ended_at = ?,
          duration_ms = ?,
          status = ?,
          metadata_json = ?,
          search_text = ?,
          updated_at = ?
        WHERE id = ?`,
      ).run(
        input.type,
        input.title ?? null,
        input.platform ?? null,
        input.startedAt,
        endedAt,
        durationMs,
        input.status,
        input.metadata ? JSON.stringify(input.metadata) : null,
        input.searchText ?? null,
        now,
        input.id,
      )
    } else {
      db.prepare(
        `INSERT INTO memory_sessions (
          id, type, title, platform, started_at, ended_at, duration_ms,
          status, metadata_json, search_text, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        input.id,
        input.type,
        input.title ?? null,
        input.platform ?? null,
        input.startedAt,
        endedAt,
        durationMs,
        input.status,
        input.metadata ? JSON.stringify(input.metadata) : null,
        input.searchText ?? null,
        input.startedAt,
        now,
      )
    }

    const row = db.prepare('SELECT * FROM memory_sessions WHERE id = ?').get(input.id)
    if (!row) throw new Error('Failed to upsert memory session')
    return mapSession(row as Record<string, unknown>)
  }

  static replaceTranscriptChunksSync(
    sessionId: string,
    chunks: SessionTranscriptChunkInput[],
  ): void {
    const db = openMemoryDatabase()
    const insert = db.prepare(
      `INSERT INTO session_transcript_chunks (
        id, session_id, seq, speaker, text, at_ms, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM session_transcript_chunks WHERE session_id = ?').run(sessionId)
      for (const chunk of chunks) {
        insert.run(
          chunk.id ?? randomUUID(),
          sessionId,
          chunk.seq,
          chunk.speaker ?? null,
          chunk.text,
          chunk.atMs,
          chunk.source ?? null,
        )
      }
    })
    tx()
  }

  static replaceInteractionsSync(
    sessionId: string,
    interactions: SessionInteractionInput[],
  ): void {
    const db = openMemoryDatabase()
    const insert = db.prepare(
      `INSERT INTO session_interactions (
        id, session_id, type, role, content, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM session_interactions WHERE session_id = ?').run(sessionId)
      for (const interaction of interactions) {
        insert.run(
          interaction.id ?? randomUUID(),
          sessionId,
          interaction.type,
          interaction.role ?? null,
          interaction.content,
          interaction.metadata ? JSON.stringify(interaction.metadata) : null,
          interaction.createdAt,
        )
      }
    })
    tx()
  }

  static deleteSessionSync(id: string): void {
    openMemoryDatabase().prepare('DELETE FROM memory_sessions WHERE id = ?').run(id)
  }

  static deleteSessionsByTypeSync(type: MemorySessionType): void {
    openMemoryDatabase().prepare('DELETE FROM memory_sessions WHERE type = ?').run(type)
  }

  static clearAllSessionsSync(): void {
    openMemoryDatabase().prepare('DELETE FROM memory_sessions').run()
  }

  static getSettings(): Promise<MemorySettings> {
    return runAsync(() => MemoryService.getSettingsSync())
  }

  static updateSettings(input: UpdateMemorySettingsInput): Promise<MemorySettings> {
    return runAsync(() => MemoryService.updateSettingsSync(input))
  }

  static getUserProfile(): Promise<UserProfile> {
    return runAsync(() => MemoryService.getUserProfileSync())
  }

  static updateUserProfile(input: UpdateUserProfileInput): Promise<UserProfile> {
    return runAsync(() => MemoryService.updateUserProfileSync(input))
  }

  static listFacts(category?: KnowledgeCategory): Promise<KnowledgeFact[]> {
    return runAsync(() => MemoryService.listFactsSync(category))
  }

  static upsertFact(input: UpsertKnowledgeFactInput): Promise<KnowledgeFact> {
    return runAsync(() => MemoryService.upsertFactSync(input))
  }

  static deleteFact(id: string): Promise<void> {
    return runAsync(() => MemoryService.deleteFactSync(id))
  }

  static createSession(input: CreateMemorySessionInput): Promise<MemorySession> {
    return runAsync(() => MemoryService.createSessionSync(input))
  }

  static getSession(id: string): Promise<MemorySession | null> {
    return runAsync(() => MemoryService.getSessionSync(id))
  }

  static listSessions(limit = 50): Promise<MemorySession[]> {
    return runAsync(() => MemoryService.listSessionsSync(limit))
  }

  static completeSession(id: string, endedAt?: number): Promise<MemorySession | null> {
    return runAsync(() => MemoryService.completeSessionSync(id, endedAt))
  }

  static upsertSession(input: UpsertMemorySessionInput): Promise<MemorySession> {
    return runAsync(() => MemoryService.upsertSessionSync(input))
  }

  static replaceTranscriptChunks(
    sessionId: string,
    chunks: SessionTranscriptChunkInput[],
  ): Promise<void> {
    return runAsync(() => MemoryService.replaceTranscriptChunksSync(sessionId, chunks))
  }

  static replaceInteractions(
    sessionId: string,
    interactions: SessionInteractionInput[],
  ): Promise<void> {
    return runAsync(() => MemoryService.replaceInteractionsSync(sessionId, interactions))
  }

  static deleteSession(id: string): Promise<void> {
    return runAsync(() => MemoryService.deleteSessionSync(id))
  }

  static deleteSessionsByType(type: MemorySessionType): Promise<void> {
    return runAsync(() => MemoryService.deleteSessionsByTypeSync(type))
  }

  static clearAllSessions(): Promise<void> {
    return runAsync(() => MemoryService.clearAllSessionsSync())
  }
}
