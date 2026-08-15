/**
 * Structured chat observability (no PII bodies).
 */

export type ChatMetricEvent = {
  scope: string
  firstTokenMs?: number
  completionMs: number
  citationCount: number
  retrievalHitIds: string[]
  streamed: boolean
  ok: boolean
  error?: string
}

export function buildChatMetricEvent(input: {
  scope: string
  startedAt: number
  firstTokenAt?: number
  finishedAt: number
  citationCount: number
  retrievalHitIds?: string[]
  streamed?: boolean
  ok: boolean
  error?: string
}): ChatMetricEvent {
  return {
    scope: input.scope || 'unknown',
    ...(typeof input.firstTokenAt === 'number'
      ? { firstTokenMs: Math.max(0, input.firstTokenAt - input.startedAt) }
      : {}),
    completionMs: Math.max(0, input.finishedAt - input.startedAt),
    citationCount: Math.max(0, input.citationCount | 0),
    retrievalHitIds: (input.retrievalHitIds ?? []).slice(0, 20),
    streamed: Boolean(input.streamed),
    ok: input.ok,
    ...(input.error ? { error: input.error } : {}),
  }
}

export function formatChatMetricLog(event: ChatMetricEvent): string {
  return `chat_metric ${JSON.stringify(event)}`
}
