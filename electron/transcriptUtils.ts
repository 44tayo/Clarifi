export type TranscriptSource = 'mic' | 'system'

export type TranscriptEntry = {
  id: string
  text: string
  source: TranscriptSource
  speaker: string
  at: number
}

const HALLUCINATION_PATTERNS = [
  /^thank you for watching\.?$/i,
  /^thanks for watching\.?$/i,
  /^thank you for listening\.?$/i,
  /^thanks for listening\.?$/i,
  /^subscribe$/i,
  /^please subscribe$/i,
  /^\[music\]$/i,
  /^\[applause\]$/i,
  /^subtitle(s)? by/i,
  /^you$/i,
  /^\.+$/,
  /^♪+$/,
  /^so, let's go\.?$/i,
  /^i'?m going to be in my car\.?$/i,
]

export type SpeakerLabels = Record<string, string>

export function defaultSpeakerForSource(source: TranscriptSource): string {
  return source === 'mic' ? 'Me' : 'Them'
}

export function isDiarizedSpeakerLabel(speaker: string): boolean {
  return /^speaker\s+\d+$/i.test(speaker.trim())
}

export function canonicalSpeakerKey(speaker: string | undefined, source: TranscriptSource): string {
  const value = speaker?.trim() ?? ''
  if (!value) return defaultSpeakerForSource(source)
  const lower = value.toLowerCase()
  if (lower === 'you' || lower === 'me') return 'Me'
  if (lower === 'them' || lower === 'remote' || lower === 'meeting') {
    return source === 'mic' ? 'Me' : 'Them'
  }
  if (isDiarizedSpeakerLabel(value)) {
    const match = value.match(/^speaker\s+(\d+)$/i)
    return match ? `Speaker ${match[1]}` : value
  }
  return value
}

export function resolveSpeakerDisplay(
  speaker: string,
  labels?: SpeakerLabels,
): string {
  const canonical = speaker.trim()
  const custom = labels?.[canonical]?.trim()
  if (custom) return custom
  return canonical
}

export function normalizeSpeakerLabel(
  speaker: string | undefined,
  source: TranscriptSource,
): string {
  return canonicalSpeakerKey(speaker, source)
}

export function normalizeTranscriptEntry(entry: Partial<TranscriptEntry> & {
  id: string
  text: string
  source: TranscriptSource
  at: number
}): TranscriptEntry {
  return {
    id: entry.id,
    text: entry.text,
    source: entry.source,
    speaker: normalizeSpeakerLabel(entry.speaker, entry.source),
    at: entry.at,
  }
}

export function speakerLabel(entry: TranscriptEntry): string {
  return entry.speaker || defaultSpeakerForSource(entry.source)
}

export function entryToLine(entry: TranscriptEntry): string {
  return `${speakerLabel(entry)}: ${entry.text}`
}

export function entriesToLines(
  entries: TranscriptEntry[],
  labels?: SpeakerLabels,
): string[] {
  return entries.map((entry) => {
    const name = resolveSpeakerDisplay(speakerLabel(entry), labels)
    return `${name}: ${entry.text}`
  })
}

export function collectDiarizedSpeakers(entries: TranscriptEntry[]): string[] {
  const speakers = new Set<string>()
  for (const entry of entries) {
    const key = speakerLabel(entry)
    if (isDiarizedSpeakerLabel(key)) speakers.add(key)
  }
  return Array.from(speakers).sort((a, b) => {
    const na = Number(a.match(/\d+/)?.[0] ?? 0)
    const nb = Number(b.match(/\d+/)?.[0] ?? 0)
    return na - nb
  })
}

export function normalizeTranscriptText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

const FILLER_TOKENS = new Set([
  'i',
  'you',
  'a',
  'the',
  'um',
  'uh',
  'ok',
  'okay',
  'yeah',
  'y',
  'e',
  'ii',
  'iii',
  'so',
  'to',
  'and',
  'or',
  'it',
  'is',
  'be',
  'we',
  'he',
  'she',
])

const SHORT_VALID_WORDS = new Set(['hi', 'hey', 'yes', 'no', 'ok', 'bye', 'hello'])

function tokenizeForAnalysis(text: string): string[] {
  return normalizeForCompare(text).split(' ').filter(Boolean)
}

export function isRepetitiveGarbage(text: string): boolean {
  const tokens = tokenizeForAnalysis(text)
  if (tokens.length === 0) return true

  if (tokens.length === 1) {
    const token = tokens[0]
    if (FILLER_TOKENS.has(token)) return true
    if (/^i+$/i.test(token) || /^y+$/i.test(token)) return true
    if (token.length <= 2 && !SHORT_VALID_WORDS.has(token)) return true
  }

  const fillerCount = tokens.filter(
    (token) =>
      FILLER_TOKENS.has(token) ||
      /^i+$/i.test(token) ||
      /^y+$/i.test(token) ||
      token.length <= 1,
  ).length
  if (tokens.length >= 2 && fillerCount / tokens.length >= 0.8) return true

  const unique = new Set(tokens)
  if (tokens.length >= 4 && unique.size <= 2) return true
  if (tokens.length >= 8 && unique.size / tokens.length < 0.3) return true
  if (
    tokens.length >= 5 &&
    tokens.every((token) => token === 'i' || token === 'you' || token === 'a')
  ) {
    return true
  }

  const compact = text.replace(/\s+/g, '').toLowerCase()
  if (compact.length >= 6 && /^[iy]+$/.test(compact)) return true

  if (isRepeatedPhraseHallucination(text)) return true

  return false
}

export function isRepeatedPhraseHallucination(text: string): boolean {
  const words = normalizeForCompare(text).split(' ').filter(Boolean)
  if (words.length < 8) return false

  for (let phraseLen = 4; phraseLen <= 12; phraseLen += 1) {
    if (words.length < phraseLen * 2) continue
    for (let start = 0; start <= words.length - phraseLen * 2; start += 1) {
      const phraseWords = words.slice(start, start + phraseLen)
      const phrase = phraseWords.join(' ')
      if (phrase.length < 12) continue

      let repeats = 1
      let cursor = start + phraseLen
      while (cursor + phraseLen <= words.length) {
        const next = words.slice(cursor, cursor + phraseLen).join(' ')
        if (next !== phrase) break
        repeats += 1
        cursor += phraseLen
      }

      if (repeats >= 2) return true
    }
  }

  return /(i'?m going to be in my car\.?\s*){2,}/i.test(text)
}

export function isLikelyHallucination(
  text: string,
  source?: TranscriptSource,
): boolean {
  const normalized = normalizeTranscriptText(text)
  if (!normalized) return true
  if (normalized.length < 2) return true
  if (isRepetitiveGarbage(normalized)) return true
  if (normalized.length <= 12 && HALLUCINATION_PATTERNS.some((p) => p.test(normalized))) {
    return true
  }
  if (HALLUCINATION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true
  }

  const tokens = tokenizeForAnalysis(normalized)
  const hasRealWord = tokens.some((token) => token.length >= 4)
  if (normalized.length < 14 && !hasRealWord) return true
  if (tokens.length >= 3 && !hasRealWord) return true

  if (source === 'mic' && tokens.length === 1 && tokens[0].length <= 3) {
    if (!SHORT_VALID_WORDS.has(tokens[0])) return true
  }

  return false
}

export function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isNearDuplicate(a: string, b: string): boolean {
  const na = normalizeForCompare(a)
  const nb = normalizeForCompare(b)
  if (!na || !nb) return false
  if (na === nb) return true

  const shorter = na.length <= nb.length ? na : nb
  const longer = na.length > nb.length ? na : nb
  if (longer.includes(shorter)) {
    return shorter.length / longer.length >= 0.65
  }

  return false
}

export function isDuplicateOfRecent(
  text: string,
  recentEntries: TranscriptEntry[],
  windowMs = 12_000,
  options?: { speaker?: string; source?: TranscriptSource; at?: number },
): boolean {
  const anchor = options?.at ?? Date.now()
  const normalized = normalizeTranscriptText(text)
  if (!normalized) return true

  const window = options?.source === 'system' ? 20_000 : windowMs

  for (const entry of recentEntries.slice(-12).reverse()) {
    if (Math.abs(anchor - entry.at) > window) continue
    if (options?.source && entry.source !== options.source) continue
    if (options?.speaker && speakerLabel(entry) !== options.speaker) continue
    if (isNearDuplicate(normalized, entry.text)) return true
  }

  return false
}

export function isDuplicateAcrossStreams(
  text: string,
  recentEntries: TranscriptEntry[],
  at: number,
  source: TranscriptSource,
  windowMs = 25_000,
): boolean {
  const normalized = normalizeTranscriptText(text)
  if (!normalized) return true

  const opposite: TranscriptSource = source === 'mic' ? 'system' : 'mic'
  const nt = normalizeForCompare(normalized)

  for (const entry of recentEntries.slice(-24).reverse()) {
    if (Math.abs(at - entry.at) > windowMs) continue
    if (entry.source !== opposite) continue

    if (isNearDuplicate(normalized, entry.text)) return true

    const ne = normalizeForCompare(entry.text)
    if (!ne || !nt) continue

    if (source === 'system' && ne.length >= nt.length && ne.includes(nt)) {
      return true
    }
    if (source === 'mic' && nt.length >= ne.length && nt.includes(ne)) {
      return true
    }
  }

  return false
}

/** Remove mic entries that are acoustic bleed from a newly confirmed system line. */
export function pruneMicBleedEntries(
  entries: TranscriptEntry[],
  systemEntry: TranscriptEntry,
  windowMs = 25_000,
): TranscriptEntry[] {
  if (systemEntry.source !== 'system') return entries

  return entries.filter((entry) => {
    if (entry.source !== 'mic') return true
    if (Math.abs(entry.at - systemEntry.at) > windowMs) return true
    return !isNearDuplicate(entry.text, systemEntry.text)
  })
}

export function buildTranscriptionPrompt(
  entries: TranscriptEntry[],
  source?: TranscriptSource,
): string {
  const scoped = source ? entries.filter((entry) => entry.source === source) : entries
  return scoped
    .slice(-3)
    .map((entry) => entry.text)
    .join(' ')
    .slice(-180)
}
