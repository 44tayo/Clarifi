/**
 * Shared chat stream / citation parsing for API + Electron + tests.
 */

export const CITATIONS_MARKER = '<<<CITATIONS>>>'

export type ChatCitation = {
  meetingId: string
  title: string
  quote?: string
  entryId?: string
  audioStartMs?: number
}

export function normalizeCitations(value: unknown): ChatCitation[] {
  if (!Array.isArray(value)) return []
  const citations: ChatCitation[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const meetingId = (entry as { meetingId?: unknown }).meetingId
    const title = (entry as { title?: unknown }).title
    const quote = (entry as { quote?: unknown }).quote
    const entryId = (entry as { entryId?: unknown }).entryId
    const audioStartMs = (entry as { audioStartMs?: unknown }).audioStartMs
    if (typeof meetingId !== 'string' || typeof title !== 'string') continue
    const id = meetingId.trim()
    const name = title.trim()
    if (!id || !name) continue
    citations.push({
      meetingId: id,
      title: name,
      ...(typeof quote === 'string' && quote.trim() ? { quote: quote.trim() } : {}),
      ...(typeof entryId === 'string' && entryId.trim() ? { entryId: entryId.trim() } : {}),
      ...(typeof audioStartMs === 'number' && Number.isFinite(audioStartMs)
        ? { audioStartMs }
        : {}),
    })
  }
  return citations
}

export function parseJsonChatReply(
  raw: string,
): { reply: string; citations: ChatCitation[] } | null {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  try {
    const parsed = JSON.parse(cleaned) as {
      reply?: unknown
      citations?: unknown
    }
    const reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : ''
    if (!reply) return null
    return { reply, citations: normalizeCitations(parsed.citations) }
  } catch {
    return null
  }
}

export function splitStreamedChatReply(raw: string): {
  reply: string
  citations: ChatCitation[]
} {
  const text = raw.trim()
  const markerIndex = text.indexOf(CITATIONS_MARKER)
  if (markerIndex >= 0) {
    const reply = text.slice(0, markerIndex).trim()
    const after = text.slice(markerIndex + CITATIONS_MARKER.length).trim()
    const cleaned = after.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
    try {
      const parsed = JSON.parse(cleaned) as unknown
      const citations = Array.isArray(parsed)
        ? normalizeCitations(parsed)
        : normalizeCitations((parsed as { citations?: unknown })?.citations)
      return { reply: reply || text, citations }
    } catch {
      return { reply: reply || text, citations: [] }
    }
  }

  const asJson = parseJsonChatReply(text)
  if (asJson) return asJson
  return { reply: text, citations: [] }
}

export function createStreamReplyEmitter(onDelta: (text: string) => void): {
  push: (delta: string) => void
  finish: () => { reply: string; citations: ChatCitation[] }
} {
  let raw = ''
  let emitted = 0
  let sealed = false
  const hold = CITATIONS_MARKER.length - 1

  return {
    push(delta: string) {
      if (!delta || sealed) return
      raw += delta
      const markerIndex = raw.indexOf(CITATIONS_MARKER)
      if (markerIndex >= 0) {
        sealed = true
        const visible = raw.slice(0, markerIndex).replace(/\s+$/, '')
        const next = visible.slice(emitted)
        if (next) onDelta(next)
        // If we already emitted trailing whitespace before the marker, callers keep it;
        // finish() still returns the trimmed reply via splitStreamedChatReply.
        emitted = Math.max(emitted, visible.length)
        return
      }
      const visibleEnd = Math.max(0, raw.length - hold)
      if (visibleEnd <= emitted) return
      const next = raw.slice(emitted, visibleEnd)
      if (next) onDelta(next)
      emitted = visibleEnd
    },
    finish() {
      if (!sealed) {
        const remaining = raw.slice(emitted)
        if (remaining) onDelta(remaining)
        emitted = raw.length
      }
      return splitStreamedChatReply(raw)
    },
  }
}

/** Extract text from an Anthropic Messages SSE `data:` line. */
export function parseAnthropicSseDataLine(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) return null
  const payload = trimmed.slice(5).trim()
  if (!payload || payload === '[DONE]') return null
  try {
    const event = JSON.parse(payload) as {
      type?: string
      delta?: { type?: string; text?: string }
    }
    if (
      event.type === 'content_block_delta' &&
      event.delta?.type === 'text_delta' &&
      typeof event.delta.text === 'string'
    ) {
      return event.delta.text
    }
  } catch {
    return null
  }
  return null
}

export type ClarifiChatSseEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; reply: string; citations?: ChatCitation[] }
  | { type: 'error'; error: string }

export function parseClarifiChatSseData(payload: string): ClarifiChatSseEvent | null {
  try {
    const event = JSON.parse(payload) as ClarifiChatSseEvent
    if (!event || typeof event !== 'object' || !('type' in event)) return null
    if (event.type === 'delta' && typeof event.text === 'string') return event
    if (event.type === 'done' && typeof event.reply === 'string') return event
    if (event.type === 'error' && typeof event.error === 'string') return event
    return null
  } catch {
    return null
  }
}
