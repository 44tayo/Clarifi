export type SharedMeetingTranscriptLine = {
  speaker: string
  text: string
  at?: number
}

export type SharedMeetingSnapshotInput = {
  id: string
  title: string
  summary?: string
  enhancedNotes?: string
  actionItems?: string[]
  userNotes?: string
  transcript?: SharedMeetingTranscriptLine[]
  attendees?: string[]
  speakerLabels?: Record<string, string>
  endedAt?: number
  createdAt?: number
}

export function appOriginFromEnv(envUrl?: string | null): string {
  return (envUrl || 'https://www.clarifiapp.com').replace(/\/$/, '')
}

export function shareUrlForToken(token: string, origin?: string): string {
  return `${appOriginFromEnv(origin)}/share/${token}`
}

export type ShareLinkAccess = 'anyone' | 'invited'

export function normalizeShareLinkAccess(value: unknown): ShareLinkAccess {
  return value === 'invited' ? 'invited' : 'anyone'
}

/**
 * Pure authorization check for viewing a shared meeting note.
 *
 * 'anyone' mode never restricts. 'invited' mode requires the requester to be
 * signed in as either the owner or an email on the invited allowlist —
 * anonymous requests (requesterEmail === null) are always denied.
 * Comparisons are case-insensitive since emails aren't case-sensitive.
 */
export function isShareViewerAuthorized(input: {
  linkAccess: ShareLinkAccess
  ownerEmail?: string | null
  invitedEmails: string[]
  requesterEmail?: string | null
}): boolean {
  if (input.linkAccess === 'anyone') return true

  const requester = input.requesterEmail?.trim().toLowerCase()
  if (!requester) return false

  if (input.ownerEmail?.trim().toLowerCase() === requester) return true

  return input.invitedEmails.some((email) => email.trim().toLowerCase() === requester)
}

export function snapshotSharedMeetingContent(meeting: SharedMeetingSnapshotInput) {
  const labels = meeting.speakerLabels ?? {}
  const transcript = (meeting.transcript ?? []).map((line) => ({
    ...line,
    speaker: labels[line.speaker]?.trim() || line.speaker,
  }))

  return {
    summary: meeting.summary ?? null,
    enhancedNotes: meeting.enhancedNotes ?? null,
    actionItems: meeting.actionItems ?? [],
    userNotes: meeting.userNotes ?? '',
    transcript,
    attendees: meeting.attendees ?? [],
    speakerLabels: labels,
    endedAt: meeting.endedAt ?? null,
    createdAt: meeting.createdAt ?? null,
    sourceMeetingId: meeting.id,
  }
}
