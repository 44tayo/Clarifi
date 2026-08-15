/** Shared enhance-notes parsing — used by Electron enhance + desktop Summary UI. */

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
  'next steps': 'Next Steps',
  nextsteps: 'Next Steps',
}

const TASK_SECTION_TITLES = new Set(['next steps', 'action items'])

function normalizeHeading(raw: string): string {
  const key = raw.replace(/^#+\s*/, '').trim().toLowerCase()
  return SECTION_ALIASES[key] ?? raw.replace(/^#+\s*/, '').trim()
}

function isTaskSectionTitle(title: string): boolean {
  return TASK_SECTION_TITLES.has(title.trim().toLowerCase())
}

/** Strip markdown bold/italic wrappers from a single line for task checklist text. */
export function stripInlineMarkdown(line: string): string {
  return line
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

/**
 * Extract checklist items from # Next Steps and/or ## Action items sections.
 * Keeps nested parent lines as separate items (flat checklist); strips bold markers.
 */
export function extractActionItems(markdown: string): string[] {
  const text = markdown.trim()
  if (!text) return []

  const sectionRegex = /^(#{1,2})\s+(.+?)\s*$/gm
  const indices: Array<{ start: number; title: string }> = []
  let match: RegExpExecArray | null
  while ((match = sectionRegex.exec(text)) !== null) {
    indices.push({ start: match.index, title: normalizeHeading(match[2] ?? '') })
  }

  const items: string[] = []
  const seen = new Set<string>()

  for (let i = 0; i < indices.length; i++) {
    const current = indices[i]!
    if (!isTaskSectionTitle(current.title)) continue
    const end = i + 1 < indices.length ? indices[i + 1]!.start : text.length
    const headingLineEnd = text.indexOf('\n', current.start)
    const bodyStart = headingLineEnd === -1 ? text.length : headingLineEnd + 1
    const body = text.slice(bodyStart, end)
    for (const line of body.split('\n')) {
      const bullet = line.match(/^\s*[-*•]\s+(.+)$/)
      if (!bullet?.[1]) continue
      const cleaned = stripInlineMarkdown(bullet[1])
      if (!cleaned || seen.has(cleaned.toLowerCase())) continue
      seen.add(cleaned.toLowerCase())
      items.push(cleaned)
    }
  }

  return items
}

/** First non-task section body, or preamble — used for legacy `summary` field. */
export function extractOverviewSummary(markdown: string): string | undefined {
  const sections = parseEnhancedSections(markdown)
  const overview = sections.find((s) => s.title === 'Overview')
  if (overview?.body.trim()) return overview.body.trim()
  const first = sections.find((s) => s.title.toLowerCase() !== 'next steps')
  return first?.body.trim() || undefined
}

export function parseEnhancedSections(
  markdown: string,
  options?: { includeActionItemsSection?: boolean },
): SummarySection[] {
  const includeActionItems = options?.includeActionItemsSection === true
  const text = markdown.trim()
  if (!text) return []

  const sectionRegex = /^(#{1,2})\s+(.+?)\s*$/gm
  const indices: Array<{ start: number; title: string }> = []
  let match: RegExpExecArray | null
  while ((match = sectionRegex.exec(text)) !== null) {
    indices.push({ start: match.index, title: normalizeHeading(match[2] ?? '') })
  }

  if (indices.length === 0) {
    return [{ id: 'overview', title: 'Overview', body: text }]
  }

  const sections: SummarySection[] = []
  for (let i = 0; i < indices.length; i++) {
    const current = indices[i]!
    // Action items live in Tasks tab; Next Steps stays in Summary for reading continuity.
    if (!includeActionItems && current.title.toLowerCase() === 'action items') continue

    const end = i + 1 < indices.length ? indices[i + 1]!.start : text.length
    const headingLineEnd = text.indexOf('\n', current.start)
    const bodyStart = headingLineEnd === -1 ? text.length : headingLineEnd + 1
    const body = text.slice(bodyStart, end).trim()
    sections.push({
      id: `${current.title.toLowerCase().replace(/\s+/g, '-')}-${i}`,
      title: current.title,
      body,
    })
  }

  return sections.length > 0
    ? sections
    : [{ id: 'overview', title: 'Overview', body: text }]
}

/** Flat bullet lines (legacy). Prefer renderNestedMarkdown for UI. */
export function formatBullets(body: string): string[] {
  return body
    .split('\n')
    .map((line) => line.replace(/^\s*[-*•]\s+/, '').trim())
    .filter(Boolean)
}

export type MdInline =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; href: string }

export type MdBlock =
  | { type: 'paragraph'; children: MdInline[] }
  | { type: 'list'; items: MdListItem[] }
  | { type: 'blockquote'; children: MdInline[] }

export type MdListItem = {
  children: MdInline[]
  nested?: MdListItem[]
}

function parseInlines(text: string): MdInline[] {
  const out: MdInline[] = []
  const re = /(\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) })
    if (m[2] || m[3]) out.push({ type: 'bold', text: m[2] || m[3] || '' })
    else if (m[4] || m[5]) out.push({ type: 'italic', text: m[4] || m[5] || '' })
    else if (m[6]) out.push({ type: 'code', text: m[6] })
    else if (m[7] && m[8]) out.push({ type: 'link', text: m[7], href: m[8] })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) })
  return out.length > 0 ? out : [{ type: 'text', text }]
}

/**
 * Parse a section body into blocks: paragraphs, nested lists, blockquotes.
 * Indentation of 2+ spaces (or a tab) under a bullet creates nesting.
 */
export function parseMarkdownBlocks(body: string): MdBlock[] {
  const lines = body.split('\n')
  const blocks: MdBlock[] = []
  let i = 0

  const bulletRe = /^(\s*)([-*•])\s+(.*)$/
  const quoteRe = /^\s*>\s?(.*)$/

  while (i < lines.length) {
    const line = lines[i] ?? ''
    if (!line.trim()) {
      i++
      continue
    }

    const quote = line.match(quoteRe)
    if (quote) {
      const chunks: string[] = [quote[1] ?? '']
      i++
      while (i < lines.length) {
        const next = lines[i] ?? ''
        const qm = next.match(quoteRe)
        if (!qm) break
        chunks.push(qm[1] ?? '')
        i++
      }
      blocks.push({ type: 'blockquote', children: parseInlines(chunks.join(' ')) })
      continue
    }

    const bullet = line.match(bulletRe)
    if (bullet) {
      const items: MdListItem[] = []
      const stack: Array<{ indent: number; item: MdListItem }> = []

      while (i < lines.length) {
        const bl = lines[i] ?? ''
        if (!bl.trim()) {
          i++
          // allow blank inside list only if next is still a bullet
          if (i < lines.length && bulletRe.test(lines[i] ?? '')) continue
          break
        }
        const bm = bl.match(bulletRe)
        if (!bm) break
        const indent = (bm[1] ?? '').replace(/\t/g, '  ').length
        const item: MdListItem = { children: parseInlines(bm[3] ?? '') }
        while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) {
          stack.pop()
        }
        if (stack.length === 0) {
          items.push(item)
          stack.push({ indent, item })
        } else {
          const parent = stack[stack.length - 1]!.item
          if (!parent.nested) parent.nested = []
          parent.nested.push(item)
          stack.push({ indent, item })
        }
        i++
      }
      blocks.push({ type: 'list', items })
      continue
    }

    const para: string[] = [line.trim()]
    i++
    while (i < lines.length) {
      const next = lines[i] ?? ''
      if (!next.trim() || bulletRe.test(next) || quoteRe.test(next) || /^#{1,2}\s+/.test(next)) break
      para.push(next.trim())
      i++
    }
    blocks.push({ type: 'paragraph', children: parseInlines(para.join(' ')) })
  }

  return blocks
}
