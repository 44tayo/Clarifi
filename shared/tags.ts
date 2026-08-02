/** Trim, drop blanks, and dedupe case-insensitively (keeps first-seen casing). */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

/** All distinct tags across meetings, case-insensitively deduped, alphabetically sorted. */
export function aggregateTags(perMeetingTags: Array<string[] | undefined>): string[] {
  const all = perMeetingTags.flatMap((tags) => tags ?? [])
  return normalizeTags(all).sort((a, b) => a.localeCompare(b))
}
