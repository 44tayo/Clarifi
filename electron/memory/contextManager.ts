import { MEMORY_CHARS_PER_TOKEN, MEMORY_CONTEXT_TOKEN_BUDGET } from './constants'
import { MemoryRepository } from './memoryRepository'
import { MemoryService } from './MemoryService'
import type { PreSessionContext, RelationshipCard } from './types'

function charBudget(): number {
  return MEMORY_CONTEXT_TOKEN_BUDGET * MEMORY_CHARS_PER_TOKEN
}

function trimToBudget(parts: string[], maxChars: number): string {
  const joined: string[] = []
  let used = 0
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    if (used + trimmed.length + 2 > maxChars) break
    joined.push(trimmed)
    used += trimmed.length + 2
  }
  return joined.join('\n\n')
}

function scoreText(text: string, terms: string[]): number {
  const lower = text.toLowerCase()
  return terms.reduce((score, term) => (lower.includes(term) ? score + 1 : score), 0)
}

export function buildMemoryContextBlock(options: {
  queryText?: string
  attendeeNames?: string[]
  company?: string
}): string {
  const settings = MemoryService.getSettingsSync()
  if (!settings.crossSessionContext) return ''

  const terms = [
    ...(options.queryText?.toLowerCase().split(/\s+/).filter((t) => t.length > 2) ?? []),
    ...(options.attendeeNames?.map((n) => n.toLowerCase()) ?? []),
    ...(options.company ? [options.company.toLowerCase()] : []),
  ].slice(0, 12)

  const query = [options.queryText, ...(options.attendeeNames ?? []), options.company]
    .filter(Boolean)
    .join(' ')

  const summaries = query.trim()
    ? MemoryRepository.searchSummaries(query, 6)
    : MemoryRepository.listRecentSummaries(4)

  const facts = MemoryService.listFactsSync()
  const rankedFacts = facts
    .map((fact) => ({
      fact,
      score: scoreText(`${fact.key ?? ''} ${fact.value}`, terms),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ fact }) => `- [${fact.category}] ${fact.key ? `${fact.key}: ` : ''}${fact.value}`)

  const profile = MemoryService.getUserProfileSync()
  const profileLines = [
    profile.name ? `Name: ${profile.name}` : '',
    profile.role ? `Role: ${profile.role}` : '',
    profile.company ? `Company: ${profile.company}` : '',
    profile.communicationStyle ? `Style: ${profile.communicationStyle}` : '',
  ].filter(Boolean)

  const preferenceProfile = profile.preferenceProfile
  const learningLines =
    preferenceProfile && typeof preferenceProfile.promptAddendum === 'string'
      ? [String(preferenceProfile.promptAddendum)]
      : []

  const summaryLines = summaries.map(
    (s) =>
      `• ${s.summary}${s.topics.length > 0 ? ` (topics: ${s.topics.slice(0, 4).join(', ')})` : ''}`,
  )

  const openItems = MemoryRepository.listOpenActionItems(5).map((item) => `- ${item.text}`)

  const body = trimToBudget(
    [
      profileLines.length > 0 ? `User profile:\n${profileLines.join('\n')}` : '',
      learningLines.length > 0 ? `Learned preferences:\n${learningLines.join('\n')}` : '',
      rankedFacts.length > 0 ? `Known facts:\n${rankedFacts.join('\n')}` : '',
      summaryLines.length > 0 ? `Relevant past sessions:\n${summaryLines.join('\n')}` : '',
      openItems.length > 0 ? `Open action items:\n${openItems.join('\n')}` : '',
    ],
    charBudget(),
  )

  if (!body) return ''
  return `\n\n<memory_context>\n${body}\n</memory_context>`
}

export function buildRelationshipCards(names: string[]): RelationshipCard[] {
  const settings = MemoryService.getSettingsSync()
  if (!settings.relationshipCards) return []

  const people = MemoryRepository.findPeopleByNames(names)
  return people.map((person) => {
    const facts = MemoryService.listFactsSync('relationships')
      .filter((f) => f.personId === person.id || f.value.toLowerCase().includes(person.normalizedName))
      .slice(0, 4)
      .map((f) => f.value)

    return {
      personId: person.id,
      name: person.name,
      company: person.company,
      role: person.role,
      lastInteractionSummary: MemoryRepository.getLatestPersonInteraction(person.id),
      keyFacts: facts,
      sentimentHint: person.sentimentHint,
      interactionCount: person.interactionCount,
    }
  })
}

export function buildPreSessionContext(options: {
  hints?: string[]
  attendeeNames?: string[]
}): PreSessionContext {
  const hints = options.hints ?? []
  const names = options.attendeeNames ?? []
  const query = [...hints, ...names].join(' ')

  const summaries = query.trim()
    ? MemoryRepository.searchSummaries(query, 4)
    : MemoryRepository.listRecentSummaries(2)

  const relatedSessions = summaries.map((s) => {
    const session = MemoryService.getSessionSync(s.sessionId)
    return {
      id: s.sessionId,
      title: session?.title ?? 'Past session',
      summary: s.summary,
      startedAt: session?.startedAt ?? s.generatedAt,
    }
  })

  const knownPeople = buildRelationshipCards(names)
  const openActionItems = MemoryRepository.listOpenActionItems(6).map((item) => item.text)

  const summaryLines: string[] = []
  if (relatedSessions.length > 0) {
    summaryLines.push(`Last time: ${relatedSessions[0].summary}`)
  }
  if (knownPeople.length > 0) {
    summaryLines.push(
      `People: ${knownPeople.map((p) => `${p.name}${p.company ? ` (${p.company})` : ''}`).join(', ')}`,
    )
  }
  if (openActionItems.length > 0) {
    summaryLines.push(`Open items: ${openActionItems.slice(0, 3).join('; ')}`)
  }

  const headline =
    knownPeople.length > 0
      ? `Clarifi remembers ${knownPeople[0].name}${knownPeople.length > 1 ? ` and ${knownPeople.length - 1} others` : ''}`
      : relatedSessions.length > 0
        ? 'Clarifi found relevant past context'
        : 'Starting fresh — Clarifi will learn from this session'

  return {
    headline,
    summaryLines,
    relatedSessions,
    knownPeople,
    openActionItems,
  }
}

export function extractNamesFromTranscript(lines: string[]): string[] {
  const names = new Set<string>()
  const pattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g
  for (const line of lines.slice(-40)) {
    for (const match of line.matchAll(pattern)) {
      const name = match[1]?.trim()
      if (!name) continue
      if (['You', 'User', 'Speaker', 'Mic', 'System'].includes(name.split(' ')[0])) continue
      if (name.length < 3) continue
      names.add(name)
    }
  }
  return [...names].slice(0, 8)
}
