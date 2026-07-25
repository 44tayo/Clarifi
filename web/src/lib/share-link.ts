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
