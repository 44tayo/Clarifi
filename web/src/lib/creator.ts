export function getCreatorUserIds(): Set<string> {
  const raw =
    process.env.CREATOR_USER_IDS?.trim() || process.env.CREATOR_CLERK_USER_IDS?.trim()
  if (!raw) return new Set()
  return new Set(raw.split(',').map((id) => id.trim()).filter(Boolean))
}

export function isCreatorUser(userId: string): boolean {
  return getCreatorUserIds().has(userId)
}

/** Emails granted lifetime Pro+ (comped accounts), comma-separated, case-insensitive. */
export function getCreatorEmails(): Set<string> {
  const raw = process.env.CREATOR_EMAILS?.trim()
  if (!raw) return new Set()
  return new Set(raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean))
}

export function isCreatorEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getCreatorEmails().has(email.toLowerCase())
}

/** True if the user qualifies for creator treatment by user ID or email. */
export function isCreator(
  userId?: string | null,
  email?: string | null,
): boolean {
  if (userId && isCreatorUser(userId)) return true
  return isCreatorEmail(email)
}
