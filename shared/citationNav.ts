/**
 * Citation navigation + guardrails for jump-to-transcript.
 */

export type CitationFocus = {
  meetingId: string
  title: string
  quote?: string
  entryId?: string
  audioStartMs?: number
}

export type TranscriptLine = {
  id: string
  text: string
  audioStartMs?: number
  at?: number
}

/** Drop citations that lack meeting identity (no evidence to open). */
export function guardCitations(
  citations: Array<Partial<CitationFocus> | null | undefined> | undefined,
): CitationFocus[] {
  if (!Array.isArray(citations)) return []
  const out: CitationFocus[] = []
  for (const citation of citations) {
    if (!citation) continue
    const meetingId = typeof citation.meetingId === 'string' ? citation.meetingId.trim() : ''
    const title = typeof citation.title === 'string' ? citation.title.trim() : ''
    if (!meetingId || !title) continue
    out.push({
      meetingId,
      title,
      ...(typeof citation.quote === 'string' && citation.quote.trim()
        ? { quote: citation.quote.trim() }
        : {}),
      ...(typeof citation.entryId === 'string' && citation.entryId.trim()
        ? { entryId: citation.entryId.trim() }
        : {}),
      ...(typeof citation.audioStartMs === 'number' && Number.isFinite(citation.audioStartMs)
        ? { audioStartMs: citation.audioStartMs }
        : {}),
    })
  }
  return out
}

export function resolveTranscriptEntryId(
  entries: TranscriptLine[],
  focus: Pick<CitationFocus, 'entryId' | 'audioStartMs' | 'quote'>,
): string | null {
  if (focus.entryId) {
    const exact = entries.find((entry) => entry.id === focus.entryId)
    if (exact) return exact.id
  }
  if (typeof focus.audioStartMs === 'number') {
    let best: TranscriptLine | null = null
    let bestDelta = Number.POSITIVE_INFINITY
    for (const entry of entries) {
      if (typeof entry.audioStartMs !== 'number') continue
      const delta = Math.abs(entry.audioStartMs - focus.audioStartMs)
      if (delta < bestDelta) {
        best = entry
        bestDelta = delta
      }
    }
    if (best && bestDelta <= 4000) return best.id
  }
  const quote = focus.quote?.trim().toLowerCase()
  if (quote) {
    const needle = quote.slice(0, 80)
    const match = entries.find((entry) => entry.text.toLowerCase().includes(needle))
    if (match) return match.id
  }
  return null
}
