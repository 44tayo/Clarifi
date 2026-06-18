import type { SessionRecap } from '../llm'
import {
  CLARIFI_MEMORY_SESSION_SUMMARY_PROMPT,
} from '../prompts'
import { MEMORY_ANALYSIS_MODEL, SUMMARY_REFRESH_DELTA } from './constants'
import { maybeRunLearningAnalysis } from './learningService'
import { completeMemoryAnalysis, parseMemoryJson } from './memoryLlm'
import { MemoryRepository } from './memoryRepository'
import { MemoryService } from './MemoryService'
import type { SessionSummaryRecord } from './types'

type SummaryLlmResult = {
  summary?: string
  topics?: string[]
  decisions?: string[]
  actionItems?: string[]
  factsLearned?: Array<{ category?: string; key?: string; value?: string }>
  peopleMentioned?: Array<{
    name?: string
    company?: string
    role?: string
    notes?: string
    sentiment?: string
  }>
}

const pendingSummaries = new Map<string, NodeJS.Timeout>()
const summarizing = new Set<string>()

function recapToSummary(sessionId: string, recap: SessionRecap): SessionSummaryRecord {
  return {
    sessionId,
    summary: recap.summary,
    topics: recap.discussionPoints.length > 0 ? recap.discussionPoints : recap.highlights,
    decisions: recap.decisions,
    actionItems: recap.actionItems,
    factsLearned: [],
    model: 'session-recap',
    generatedAt: Date.now(),
  }
}

function shouldRefreshSummary(sessionId: string): boolean {
  const existing = MemoryRepository.getSessionSummary(sessionId)
  if (!existing) return true
  const counts = MemoryRepository.countSessionContent(sessionId)
  const total = counts.chunks + counts.interactions
  const storedTotal = existing.topics.length + existing.actionItems.length + existing.decisions.length
  return total >= storedTotal + SUMMARY_REFRESH_DELTA
}

function buildSessionContent(sessionId: string): string | null {
  const session = MemoryService.getSessionSync(sessionId)
  if (!session) return null

  const transcript = MemoryRepository.getSessionTranscriptText(sessionId)
  const interactions = MemoryRepository.getSessionInteractionText(sessionId)
  const lines = [...transcript, ...interactions]
  if (lines.length === 0) return null

  return [
    `Session type: ${session.type}`,
    session.title ? `Title: ${session.title}` : '',
    '',
    'Content:',
    lines.join('\n'),
  ]
    .filter(Boolean)
    .join('\n')
}

async function applySummarySideEffects(
  sessionId: string,
  summary: SessionSummaryRecord,
  peopleMentioned: SummaryLlmResult['peopleMentioned'],
): Promise<void> {
  MemoryRepository.upsertSessionSummary(summary)

  for (const fact of summary.factsLearned) {
    if (!fact.value.trim()) continue
    MemoryService.upsertFactSync({
      category: fact.category,
      key: fact.key,
      value: fact.value,
      source: 'inferred',
      confidence: 0.75,
      sessionId,
    })
  }

  if (summary.actionItems.length > 0) {
    MemoryRepository.createActionItems(sessionId, summary.actionItems)
  }

  for (const person of peopleMentioned ?? []) {
    if (!person?.name?.trim()) continue
    const record = MemoryRepository.upsertPerson({
      name: person.name.trim(),
      company: person.company?.trim() || null,
      role: person.role?.trim() || null,
      notes: person.notes?.trim() || null,
      sentimentHint: person.sentiment?.trim() || null,
    })
    MemoryRepository.linkSessionPerson(sessionId, record.id, person.role ?? null)
    MemoryRepository.addPersonInteraction(
      record.id,
      sessionId,
      summary.summary.slice(0, 500),
      person.sentiment ?? null,
    )
  }

  void maybeRunLearningAnalysis()
}

export async function summarizeMemorySession(sessionId: string): Promise<void> {
  if (summarizing.has(sessionId)) return
  if (!shouldRefreshSummary(sessionId)) return

  const session = MemoryService.getSessionSync(sessionId)
  if (!session) return

  summarizing.add(sessionId)
  try {
    const metadata = session.metadata ?? {}
    const existingRecap = metadata.recap as SessionRecap | null | undefined
    if (existingRecap?.summary && session.type === 'live_call') {
      const summary = recapToSummary(sessionId, existingRecap)
      await applySummarySideEffects(sessionId, summary, [])
      return
    }

    const content = buildSessionContent(sessionId)
    if (!content) return

    const text = await completeMemoryAnalysis(
      CLARIFI_MEMORY_SESSION_SUMMARY_PROMPT,
      content.slice(0, 120_000),
      1400,
    )
    if (!text) return

    const parsed = parseMemoryJson<SummaryLlmResult>(text)
    if (!parsed?.summary?.trim()) return

    const summary: SessionSummaryRecord = {
      sessionId,
      summary: parsed.summary.trim(),
      topics: Array.isArray(parsed.topics) ? parsed.topics.filter(Boolean).slice(0, 12) : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions.filter(Boolean).slice(0, 12) : [],
      actionItems: Array.isArray(parsed.actionItems)
        ? parsed.actionItems.filter(Boolean).slice(0, 12)
        : [],
      factsLearned: Array.isArray(parsed.factsLearned)
        ? parsed.factsLearned
            .filter((f) => f?.value?.trim())
            .map((f) => ({
              category: (['profile', 'work', 'relationships', 'preferences'].includes(
                String(f.category),
              )
                ? String(f.category)
                : 'work') as SessionSummaryRecord['factsLearned'][number]['category'],
              key: f.key?.trim() || null,
              value: String(f.value).trim(),
            }))
            .slice(0, 15)
        : [],
      model: MEMORY_ANALYSIS_MODEL,
      generatedAt: Date.now(),
    }

    await applySummarySideEffects(sessionId, summary, parsed.peopleMentioned)
    console.log(`[memory] summarised session ${sessionId}`)
  } catch (err) {
    console.error(`[memory] summarisation failed for ${sessionId}:`, err)
  } finally {
    summarizing.delete(sessionId)
  }
}

export function queueSessionSummarization(sessionId: string, delayMs = 1500): void {
  const existing = pendingSummaries.get(sessionId)
  if (existing) clearTimeout(existing)

  const timeout = setTimeout(() => {
    pendingSummaries.delete(sessionId)
    void summarizeMemorySession(sessionId)
  }, delayMs)

  pendingSummaries.set(sessionId, timeout)
}

export function queueSummarizationAfterSync(
  sessionId: string,
  options: { completed: boolean; contentCount: number },
): void {
  if (!options.completed && options.contentCount < 4) return
  queueSessionSummarization(sessionId)
}
