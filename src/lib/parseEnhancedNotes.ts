/** Parse enhance markdown into labeled sections for Summary UI. */

export type SummarySection = {
  id: string
  title: string
  body: string
}

const SECTION_ALIASES: Record<string, string> = {
  summary: 'Overview',
  overview: 'Overview',
  'key points': 'Key points',
  keypoints: 'Key points',
  decisions: 'Decisions',
  'action items': 'Action items',
  actionitems: 'Action items',
}

function normalizeHeading(raw: string): string {
  const key = raw.replace(/^#+\s*/, '').trim().toLowerCase()
  return SECTION_ALIASES[key] ?? raw.replace(/^#+\s*/, '').trim()
}

export function parseEnhancedSections(markdown: string): SummarySection[] {
  const text = markdown.trim()
  if (!text) return []

  const parts = text.split(/^##\s+/m)
  if (parts.length <= 1) {
    return [{ id: 'overview', title: 'Overview', body: text }]
  }

  const sections: SummarySection[] = []
  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i]!.trim()
    if (!chunk) continue
    const nl = chunk.indexOf('\n')
    const headingRaw = nl === -1 ? chunk : chunk.slice(0, nl)
    const body = nl === -1 ? '' : chunk.slice(nl + 1).trim()
    const title = normalizeHeading(headingRaw)
    if (title === 'Action items') continue
    sections.push({
      id: `${title.toLowerCase().replace(/\s+/g, '-')}-${i}`,
      title,
      body,
    })
  }
  return sections.length > 0
    ? sections
    : [{ id: 'overview', title: 'Overview', body: text }]
}

export function formatBullets(body: string): string[] {
  return body
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s+/, '').trim())
    .filter(Boolean)
}
