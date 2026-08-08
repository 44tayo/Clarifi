/**
 * Local-first hybrid RAG over meeting notes + transcript windows.
 * Embeddings use a deterministic local hasher (no network) so retrieval
 * works offline; empty embeddings fall back to keyword + recency.
 */

export type RetrievalMeeting = {
  id: string
  title: string
  summary?: string
  enhancedNotes?: string
  userNotes?: string
  attendeeEmails?: string[]
  transcript?: Array<{ text: string; at?: number }>
  startedAt?: number
  createdAt: number
}

export type RetrievalChunk = {
  id: string
  meetingId: string
  title: string
  text: string
  kind: 'notes' | 'transcript' | 'summary'
  recency: number
  embedding: number[]
}

export type HybridHit = {
  chunk: RetrievalChunk
  score: number
  keyword: number
  cosine: number
  recencyBoost: number
}

const EMBED_DIM = 64
const DEFAULT_TOP_K = 8
const DEFAULT_BUDGET = 12_000

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2)
}

/** Deterministic local embedding (hashed bag-of-tokens into fixed dims). */
export function embedTextLocal(text: string, dim = EMBED_DIM): number[] {
  const vec = new Array<number>(dim).fill(0)
  const tokens = tokenize(text)
  if (tokens.length === 0) return vec
  for (const token of tokens) {
    let hash = 2166136261
    for (let i = 0; i < token.length; i++) {
      hash ^= token.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
    const index = Math.abs(hash) % dim
    const sign = hash & 1 ? 1 : -1
    vec[index] += sign
  }
  const norm = Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0)) || 1
  return vec.map((value) => value / norm)
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

function splitWindows(text: string, size = 700, overlap = 120): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return []
  if (cleaned.length <= size) return [cleaned]
  const windows: string[] = []
  let start = 0
  while (start < cleaned.length) {
    const end = Math.min(cleaned.length, start + size)
    windows.push(cleaned.slice(start, end).trim())
    if (end >= cleaned.length) break
    start = Math.max(end - overlap, start + 1)
  }
  return windows.filter(Boolean)
}

export function chunkMeeting(meeting: RetrievalMeeting, withEmbeddings = true): RetrievalChunk[] {
  const recency = meeting.startedAt ?? meeting.createdAt
  const title = meeting.title || 'Untitled meeting'
  const chunks: RetrievalChunk[] = []

  const push = (kind: RetrievalChunk['kind'], text: string, suffix: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    for (const [index, window] of splitWindows(trimmed).entries()) {
      chunks.push({
        id: `${meeting.id}:${kind}:${suffix}:${index}`,
        meetingId: meeting.id,
        title,
        text: window,
        kind,
        recency,
        embedding: withEmbeddings ? embedTextLocal(`${title}\n${window}`) : [],
      })
    }
  }

  push('notes', meeting.enhancedNotes || '', 'enhanced')
  push('notes', meeting.userNotes || '', 'user')
  push('summary', meeting.summary || '', 'summary')

  if (Array.isArray(meeting.transcript) && meeting.transcript.length > 0) {
    const lines = meeting.transcript.map((entry) => entry.text).filter(Boolean)
    for (let i = 0; i < lines.length; i += 8) {
      const slice = lines.slice(i, i + 8).join(' ')
      push('transcript', slice, `t${i}`)
    }
  }

  return chunks
}

function keywordScore(text: string, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0
  const haystack = text.toLowerCase()
  let score = 0
  for (const token of queryTokens) {
    if (haystack.includes(token)) score += token.length >= 6 ? 2 : 1
  }
  return score
}

export function hybridRetrieve(
  chunks: RetrievalChunk[],
  query: string,
  options?: { topK?: number; now?: number },
): HybridHit[] {
  const topK = options?.topK ?? DEFAULT_TOP_K
  const now = options?.now ?? Date.now()
  const queryTokens = tokenize(query)
  const queryEmbedding = embedTextLocal(query)
  const hasEmbeddings = chunks.some((chunk) => chunk.embedding.length > 0)

  const scored = chunks.map((chunk) => {
    const keyword = keywordScore(`${chunk.title}\n${chunk.text}`, queryTokens)
    const cosine = hasEmbeddings ? cosineSimilarity(queryEmbedding, chunk.embedding) : 0
    const ageDays = Math.max(0, (now - chunk.recency) / (1000 * 60 * 60 * 24))
    const recencyBoost = 1 / (1 + ageDays / 30)
    const score = keyword * 2 + cosine * 5 + recencyBoost
    return { chunk, score, keyword, cosine, recencyBoost }
  })

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.chunk.recency - a.chunk.recency
  })

  // Prefer diversity across meetings while keeping top scores.
  const picked: HybridHit[] = []
  const perMeeting = new Map<string, number>()
  for (const hit of scored) {
    if (hit.score <= 0 && picked.length > 0) continue
    const count = perMeeting.get(hit.chunk.meetingId) ?? 0
    if (count >= 3) continue
    picked.push(hit)
    perMeeting.set(hit.chunk.meetingId, count + 1)
    if (picked.length >= topK) break
  }

  if (picked.length === 0 && scored.length > 0) {
    return scored.slice(0, Math.min(topK, scored.length))
  }
  return picked
}

export function packHybridHits(hits: HybridHit[], budgetChars = DEFAULT_BUDGET): string {
  if (hits.length === 0) return ''
  const chunks: string[] = []
  let used = 0
  for (const hit of hits) {
    const block = [
      `### ${hit.chunk.title} [${hit.chunk.kind}] (id:${hit.chunk.meetingId})`,
      hit.chunk.text.slice(0, 1800),
    ].join('\n')
    if (used + block.length > budgetChars && chunks.length > 0) break
    chunks.push(block)
    used += block.length + 2
  }
  return [
    'You have context from Clarifi meeting memory (hybrid retrieval). Answer from this context and cite meeting titles/ids.',
    '',
    chunks.join('\n\n'),
  ].join('\n')
}

export function buildIndexFromMeetings(
  meetings: RetrievalMeeting[],
  withEmbeddings = true,
): RetrievalChunk[] {
  return meetings.flatMap((meeting) => chunkMeeting(meeting, withEmbeddings))
}

export function retrieveAndPack(
  meetings: RetrievalMeeting[],
  query: string,
  options?: { topK?: number; budgetChars?: number; withEmbeddings?: boolean; now?: number },
): { packed: string; hits: HybridHit[] } {
  const chunks = buildIndexFromMeetings(meetings, options?.withEmbeddings !== false)
  const hits = hybridRetrieve(chunks, query, { topK: options?.topK, now: options?.now })
  return {
    hits,
    packed: packHybridHits(hits, options?.budgetChars ?? DEFAULT_BUDGET),
  }
}
