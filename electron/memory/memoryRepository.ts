import { randomUUID } from 'crypto'
import { openMemoryDatabase } from './db'
import type {
  ActionItemRecord,
  DailyBriefingRecord,
  KnowledgeCategory,
  LearningInsight,
  PersonRecord,
  RecordSuggestionFeedbackInput,
  SessionSummaryRecord,
  UpsertPersonInput,
} from './types'

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

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function mapSummary(row: Record<string, unknown>): SessionSummaryRecord {
  const factsRaw = parseJsonObject(row.facts_learned_json as string | null)
  const factsLearned = Array.isArray(factsRaw)
    ? factsRaw
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const fact = item as Record<string, unknown>
          return {
            category: String(fact.category ?? 'work') as KnowledgeCategory,
            key: fact.key == null ? null : String(fact.key),
            value: String(fact.value ?? ''),
          }
        })
        .filter((f) => f.value.trim())
    : []

  return {
    sessionId: String(row.session_id),
    summary: String(row.summary),
    topics: parseJsonArray(row.topics_json as string | null),
    decisions: parseJsonArray(row.decisions_json as string | null),
    actionItems: parseJsonArray(row.action_items_json as string | null),
    factsLearned,
    model: row.model == null ? null : String(row.model),
    generatedAt: Number(row.generated_at),
  }
}

function mapPerson(row: Record<string, unknown>): PersonRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    normalizedName: String(row.normalized_name),
    company: row.company == null ? null : String(row.company),
    role: row.role == null ? null : String(row.role),
    email: row.email == null ? null : String(row.email),
    notes: row.notes == null ? null : String(row.notes),
    sentimentHint: row.sentiment_hint == null ? null : String(row.sentiment_hint),
    firstSeenAt: Number(row.first_seen_at),
    lastSeenAt: Number(row.last_seen_at),
    interactionCount: Number(row.interaction_count),
    metadata: parseJsonObject(row.metadata_json as string | null),
  }
}

function mapActionItem(row: Record<string, unknown>): ActionItemRecord {
  return {
    id: String(row.id),
    sessionId: row.session_id == null ? null : String(row.session_id),
    personId: row.person_id == null ? null : String(row.person_id),
    text: String(row.text),
    status: String(row.status) as ActionItemRecord['status'],
    dueAt: row.due_at == null ? null : Number(row.due_at),
    completedAt: row.completed_at == null ? null : Number(row.completed_at),
    source: String(row.source),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }
}

function mapBriefing(row: Record<string, unknown>): DailyBriefingRecord {
  return {
    id: String(row.id),
    briefingDate: String(row.briefing_date),
    contentMarkdown: String(row.content_markdown),
    content: parseJsonObject(row.content_json as string | null) ?? {},
    calendar: parseJsonObject(row.calendar_json as string | null),
    generatedAt: Number(row.generated_at),
    dismissedAt: row.dismissed_at == null ? null : Number(row.dismissed_at),
    pinned: Boolean(row.pinned),
  }
}

export class MemoryRepository {
  static getSessionSummary(sessionId: string): SessionSummaryRecord | null {
    const row = openMemoryDatabase()
      .prepare('SELECT * FROM session_summaries WHERE session_id = ?')
      .get(sessionId)
    return row ? mapSummary(row as Record<string, unknown>) : null
  }

  static upsertSessionSummary(summary: SessionSummaryRecord): void {
    openMemoryDatabase()
      .prepare(
        `INSERT INTO session_summaries (
          session_id, summary, topics_json, decisions_json, action_items_json,
          facts_learned_json, model, generated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          summary = excluded.summary,
          topics_json = excluded.topics_json,
          decisions_json = excluded.decisions_json,
          action_items_json = excluded.action_items_json,
          facts_learned_json = excluded.facts_learned_json,
          model = excluded.model,
          generated_at = excluded.generated_at`,
      )
      .run(
        summary.sessionId,
        summary.summary,
        JSON.stringify(summary.topics),
        JSON.stringify(summary.decisions),
        JSON.stringify(summary.actionItems),
        JSON.stringify(summary.factsLearned),
        summary.model,
        summary.generatedAt,
      )
  }

  static listRecentSummaries(limit = 20): SessionSummaryRecord[] {
    const rows = openMemoryDatabase()
      .prepare(
        `SELECT ss.* FROM session_summaries ss
         JOIN memory_sessions ms ON ms.id = ss.session_id
         ORDER BY ss.generated_at DESC
         LIMIT ?`,
      )
      .all(limit)
    return rows.map((row) => mapSummary(row as Record<string, unknown>))
  }

  static searchSummaries(query: string, limit = 8): SessionSummaryRecord[] {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2)
      .slice(0, 6)
    if (terms.length === 0) return MemoryRepository.listRecentSummaries(limit)

    const rows = openMemoryDatabase()
      .prepare(
        `SELECT ss.* FROM session_summaries ss
         JOIN memory_sessions ms ON ms.id = ss.session_id
         WHERE ${terms.map(() => '(LOWER(ss.summary) LIKE ? OR LOWER(ms.search_text) LIKE ? OR LOWER(ms.title) LIKE ?)').join(' OR ')}
         ORDER BY ss.generated_at DESC
         LIMIT ?`,
      )
      .all(
        ...terms.flatMap((term) => {
          const like = `%${term}%`
          return [like, like, like]
        }),
        limit,
      )

    return rows.map((row) => mapSummary(row as Record<string, unknown>))
  }

  static countSessionContent(sessionId: string): { chunks: number; interactions: number } {
    const db = openMemoryDatabase()
    const chunks = db
      .prepare('SELECT COUNT(*) AS count FROM session_transcript_chunks WHERE session_id = ?')
      .get(sessionId) as { count: number }
    const interactions = db
      .prepare('SELECT COUNT(*) AS count FROM session_interactions WHERE session_id = ?')
      .get(sessionId) as { count: number }
    return { chunks: chunks.count, interactions: interactions.count }
  }

  static getSessionTranscriptText(sessionId: string, maxLines = 200): string[] {
    const rows = openMemoryDatabase()
      .prepare(
        `SELECT speaker, text FROM session_transcript_chunks
         WHERE session_id = ?
         ORDER BY seq ASC
         LIMIT ?`,
      )
      .all(sessionId, maxLines) as Array<{ speaker: string | null; text: string }>
    return rows.map((row) => {
      const speaker = row.speaker?.trim()
      return speaker ? `${speaker}: ${row.text}` : row.text
    })
  }

  static getSessionInteractionText(sessionId: string, maxMessages = 80): string[] {
    const rows = openMemoryDatabase()
      .prepare(
        `SELECT role, content FROM session_interactions
         WHERE session_id = ?
         ORDER BY created_at ASC
         LIMIT ?`,
      )
      .all(sessionId, maxMessages) as Array<{ role: string | null; content: string }>
    return rows.map((row) => {
      const role = row.role?.trim() || 'user'
      return `${role}: ${row.content}`
    })
  }

  static upsertPerson(input: UpsertPersonInput): PersonRecord {
    const db = openMemoryDatabase()
    const now = Date.now()
    const id = input.id ?? randomUUID()
    const normalizedName = normalizeName(input.name)
    const company = input.company?.trim() || null

    const existing = db
      .prepare(
        `SELECT * FROM people
         WHERE normalized_name = ? AND IFNULL(company, '') = IFNULL(?, '')`,
      )
      .get(normalizedName, company) as Record<string, unknown> | undefined

    if (existing) {
      db.prepare(
        `UPDATE people SET
          name = ?,
          role = COALESCE(?, role),
          email = COALESCE(?, email),
          notes = COALESCE(?, notes),
          sentiment_hint = COALESCE(?, sentiment_hint),
          last_seen_at = ?,
          interaction_count = interaction_count + 1,
          metadata_json = COALESCE(?, metadata_json)
        WHERE id = ?`,
      ).run(
        input.name.trim(),
        input.role ?? null,
        input.email ?? null,
        input.notes ?? null,
        input.sentimentHint ?? null,
        now,
        input.metadata ? JSON.stringify(input.metadata) : null,
        existing.id,
      )
      const row = db.prepare('SELECT * FROM people WHERE id = ?').get(existing.id)
      return mapPerson(row as Record<string, unknown>)
    }

    db.prepare(
      `INSERT INTO people (
        id, name, normalized_name, company, role, email, notes,
        sentiment_hint, first_seen_at, last_seen_at, interaction_count, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    ).run(
      id,
      input.name.trim(),
      normalizedName,
      company,
      input.role ?? null,
      input.email ?? null,
      input.notes ?? null,
      input.sentimentHint ?? null,
      now,
      now,
      input.metadata ? JSON.stringify(input.metadata) : null,
    )

    const row = db.prepare('SELECT * FROM people WHERE id = ?').get(id)
    return mapPerson(row as Record<string, unknown>)
  }

  static linkSessionPerson(sessionId: string, personId: string, role?: string | null): void {
    openMemoryDatabase()
      .prepare(
        `INSERT INTO session_people (session_id, person_id, role)
         VALUES (?, ?, ?)
         ON CONFLICT(session_id, person_id) DO UPDATE SET role = excluded.role`,
      )
      .run(sessionId, personId, role ?? null)
  }

  static listPeople(query?: string, limit = 100): PersonRecord[] {
    const db = openMemoryDatabase()
    const rows = query?.trim()
      ? db
          .prepare(
            `SELECT * FROM people
             WHERE LOWER(name) LIKE ? OR LOWER(IFNULL(company, '')) LIKE ?
             ORDER BY last_seen_at DESC
             LIMIT ?`,
          )
          .all(`%${query.trim().toLowerCase()}%`, `%${query.trim().toLowerCase()}%`, limit)
      : db.prepare('SELECT * FROM people ORDER BY last_seen_at DESC LIMIT ?').all(limit)
    return rows.map((row) => mapPerson(row as Record<string, unknown>))
  }

  static getPerson(id: string): PersonRecord | null {
    const row = openMemoryDatabase().prepare('SELECT * FROM people WHERE id = ?').get(id)
    return row ? mapPerson(row as Record<string, unknown>) : null
  }

  static findPeopleByNames(names: string[]): PersonRecord[] {
    const normalized = names.map(normalizeName).filter(Boolean)
    if (normalized.length === 0) return []
    const placeholders = normalized.map(() => '?').join(', ')
    const rows = openMemoryDatabase()
      .prepare(`SELECT * FROM people WHERE normalized_name IN (${placeholders})`)
      .all(...normalized)
    return rows.map((row) => mapPerson(row as Record<string, unknown>))
  }

  static updatePerson(
    id: string,
    input: Partial<Omit<UpsertPersonInput, 'id'>>,
  ): PersonRecord | null {
    const existing = MemoryRepository.getPerson(id)
    if (!existing) return null
    return MemoryRepository.upsertPerson({
      id,
      name: input.name ?? existing.name,
      company: input.company ?? existing.company,
      role: input.role ?? existing.role,
      email: input.email ?? existing.email,
      notes: input.notes ?? existing.notes,
      sentimentHint: input.sentimentHint ?? existing.sentimentHint,
      metadata: input.metadata ?? existing.metadata,
    })
  }

  static deletePerson(id: string): void {
    openMemoryDatabase().prepare('DELETE FROM people WHERE id = ?').run(id)
  }

  static addPersonInteraction(
    personId: string,
    sessionId: string | null,
    summary: string,
    sentiment?: string | null,
  ): void {
    openMemoryDatabase()
      .prepare(
        `INSERT INTO person_interactions (id, person_id, session_id, summary, sentiment, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(randomUUID(), personId, sessionId, summary, sentiment ?? null, Date.now())
  }

  static getLatestPersonInteraction(personId: string): string | null {
    const row = openMemoryDatabase()
      .prepare(
        `SELECT summary FROM person_interactions
         WHERE person_id = ?
         ORDER BY occurred_at DESC
         LIMIT 1`,
      )
      .get(personId) as { summary: string } | undefined
    return row?.summary ?? null
  }

  static createActionItems(
    sessionId: string | null,
    items: string[],
    source = 'session_summary',
  ): ActionItemRecord[] {
    const db = openMemoryDatabase()
    const now = Date.now()
    const insert = db.prepare(
      `INSERT INTO action_items (
        id, session_id, person_id, text, status, due_at, completed_at, source, created_at, updated_at
      ) VALUES (?, ?, NULL, ?, 'open', NULL, NULL, ?, ?, ?)`,
    )
    const created: ActionItemRecord[] = []
    for (const text of items) {
      const trimmed = text.trim()
      if (!trimmed) continue
      const id = randomUUID()
      insert.run(id, sessionId, trimmed, source, now, now)
      const row = db.prepare('SELECT * FROM action_items WHERE id = ?').get(id)
      if (row) created.push(mapActionItem(row as Record<string, unknown>))
    }
    return created
  }

  static listOpenActionItems(limit = 30): ActionItemRecord[] {
    const rows = openMemoryDatabase()
      .prepare(
        `SELECT * FROM action_items
         WHERE status = 'open'
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(limit)
    return rows.map((row) => mapActionItem(row as Record<string, unknown>))
  }

  static completeActionItem(id: string): ActionItemRecord | null {
    const now = Date.now()
    openMemoryDatabase()
      .prepare(
        `UPDATE action_items SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`,
      )
      .run(now, now, id)
    const row = openMemoryDatabase().prepare('SELECT * FROM action_items WHERE id = ?').get(id)
    return row ? mapActionItem(row as Record<string, unknown>) : null
  }

  static getBriefingForDate(date: string): DailyBriefingRecord | null {
    const row = openMemoryDatabase()
      .prepare('SELECT * FROM daily_briefings WHERE briefing_date = ?')
      .get(date)
    return row ? mapBriefing(row as Record<string, unknown>) : null
  }

  static upsertBriefing(record: DailyBriefingRecord): void {
    openMemoryDatabase()
      .prepare(
        `INSERT INTO daily_briefings (
          id, briefing_date, content_json, content_markdown, calendar_json,
          generated_at, dismissed_at, pinned
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(briefing_date) DO UPDATE SET
          content_json = excluded.content_json,
          content_markdown = excluded.content_markdown,
          calendar_json = excluded.calendar_json,
          generated_at = excluded.generated_at,
          dismissed_at = excluded.dismissed_at,
          pinned = excluded.pinned`,
      )
      .run(
        record.id,
        record.briefingDate,
        JSON.stringify(record.content),
        record.contentMarkdown,
        record.calendar ? JSON.stringify(record.calendar) : null,
        record.generatedAt,
        record.dismissedAt,
        record.pinned ? 1 : 0,
      )
  }

  static dismissBriefing(date: string): void {
    openMemoryDatabase()
      .prepare('UPDATE daily_briefings SET dismissed_at = ? WHERE briefing_date = ?')
      .run(Date.now(), date)
  }

  static pinBriefing(date: string, pinned: boolean): void {
    openMemoryDatabase()
      .prepare('UPDATE daily_briefings SET pinned = ? WHERE briefing_date = ?')
      .run(pinned ? 1 : 0, date)
  }

  static getLatestUndismissedBriefing(): DailyBriefingRecord | null {
    const row = openMemoryDatabase()
      .prepare(
        `SELECT * FROM daily_briefings
         WHERE dismissed_at IS NULL OR pinned = 1
         ORDER BY generated_at DESC
         LIMIT 1`,
      )
      .get()
    return row ? mapBriefing(row as Record<string, unknown>) : null
  }

  static recordSuggestionFeedback(input: RecordSuggestionFeedbackInput): void {
    openMemoryDatabase()
      .prepare(
        `INSERT INTO suggestion_feedback (
          id, session_id, interaction_id, suggestion_type, original_text, outcome, edited_text, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        input.sessionId ?? null,
        input.interactionId ?? null,
        input.suggestionType,
        input.originalText,
        input.outcome,
        input.editedText ?? null,
        Date.now(),
      )
  }

  static countCompletedSessions(): number {
    const row = openMemoryDatabase()
      .prepare(`SELECT COUNT(*) AS count FROM memory_sessions WHERE status = 'completed'`)
      .get() as { count: number }
    return row.count
  }

  static countFeedbackSince(appliedAt: number): number {
    const row = openMemoryDatabase()
      .prepare('SELECT COUNT(*) AS count FROM suggestion_feedback WHERE created_at > ?')
      .get(appliedAt) as { count: number }
    return row.count
  }

  static getLatestLearningRun(): LearningInsight | null {
    const row = openMemoryDatabase()
      .prepare('SELECT * FROM learning_runs ORDER BY applied_at DESC LIMIT 1')
      .get()
    if (!row) return null
    const record = row as Record<string, unknown>
    return {
      id: String(record.id),
      sessionCount: Number(record.session_count),
      insights: parseJsonObject(record.insights_json as string | null) ?? {},
      appliedAt: Number(record.applied_at),
    }
  }

  static saveLearningRun(sessionCount: number, insights: Record<string, unknown>): LearningInsight {
    const id = randomUUID()
    const appliedAt = Date.now()
    openMemoryDatabase()
      .prepare(
        `INSERT INTO learning_runs (id, session_count, insights_json, applied_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(id, sessionCount, JSON.stringify(insights), appliedAt)
    return { id, sessionCount, insights, appliedAt }
  }

  static listRecentFeedback(limit = 40): Array<{
    suggestionType: string
    originalText: string
    outcome: string
    editedText: string | null
    createdAt: number
  }> {
    const rows = openMemoryDatabase()
      .prepare(
        `SELECT suggestion_type, original_text, outcome, edited_text, created_at
         FROM suggestion_feedback
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(limit) as Array<Record<string, unknown>>
    return rows.map((row) => ({
      suggestionType: String(row.suggestion_type),
      originalText: String(row.original_text),
      outcome: String(row.outcome),
      editedText: row.edited_text == null ? null : String(row.edited_text),
      createdAt: Number(row.created_at),
    }))
  }

  static clearAllMemoryData(): void {
    const db = openMemoryDatabase()
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM context_injection_cache').run()
      db.prepare('DELETE FROM learning_runs').run()
      db.prepare('DELETE FROM suggestion_feedback').run()
      db.prepare('DELETE FROM daily_briefings').run()
      db.prepare('DELETE FROM calendar_tokens').run()
      db.prepare('DELETE FROM action_items').run()
      db.prepare('DELETE FROM person_interactions').run()
      db.prepare('DELETE FROM session_people').run()
      db.prepare('DELETE FROM people').run()
      db.prepare('DELETE FROM session_interactions').run()
      db.prepare('DELETE FROM session_transcript_chunks').run()
      db.prepare('DELETE FROM session_summaries').run()
      db.prepare('DELETE FROM knowledge_facts').run()
      db.prepare('DELETE FROM memory_sessions').run()
    })
    tx()
  }

  static purgeSessionsOlderThan(cutoffMs: number): number {
    const db = openMemoryDatabase()
    const result = db
      .prepare('DELETE FROM memory_sessions WHERE started_at < ?')
      .run(cutoffMs)
    return result.changes
  }
}
