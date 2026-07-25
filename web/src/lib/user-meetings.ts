import { getSupabaseAdmin } from '@/lib/supabase-admin'

export type CloudMeetingPayload = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  startedAt?: number
  endedAt?: number
  status: string
  userNotes: string
  transcript: unknown[]
  speakerLabels?: Record<string, string>
  speakerIdentities?: Record<string, { displayName: string; email?: string; source: string }>
  calendarEventId?: string
  calendarProvider?: string
  scheduledStart?: number
  attendeeEmails?: string[]
  attendees?: Array<{ email: string; name: string | null; self?: boolean }>
  folderIds?: string[]
  enhancedNotes?: string
  summary?: string
  actionItems?: string[]
}

function admin() {
  const client = getSupabaseAdmin()
  if (!client) throw new Error('storage_unavailable')
  return client
}

function rowToMeeting(row: Record<string, unknown>): CloudMeetingPayload {
  return {
    id: String(row.meeting_id),
    title: String(row.title ?? 'Untitled meeting'),
    createdAt: Number(row.created_at_ms) || 0,
    updatedAt: Number(row.updated_at_ms) || 0,
    startedAt: row.started_at_ms != null ? Number(row.started_at_ms) : undefined,
    endedAt: row.ended_at_ms != null ? Number(row.ended_at_ms) : undefined,
    status: String(row.status ?? 'ready'),
    userNotes: typeof row.user_notes === 'string' ? row.user_notes : '',
    transcript: Array.isArray(row.transcript) ? row.transcript : [],
    speakerLabels:
      row.speaker_labels && typeof row.speaker_labels === 'object'
        ? (row.speaker_labels as Record<string, string>)
        : {},
    speakerIdentities:
      row.speaker_identities && typeof row.speaker_identities === 'object'
        ? (row.speaker_identities as CloudMeetingPayload['speakerIdentities'])
        : {},
    calendarEventId:
      typeof row.calendar_event_id === 'string' ? row.calendar_event_id : undefined,
    calendarProvider:
      typeof row.calendar_provider === 'string' ? row.calendar_provider : undefined,
    scheduledStart:
      row.scheduled_start_ms != null ? Number(row.scheduled_start_ms) : undefined,
    attendeeEmails: Array.isArray(row.attendee_emails)
      ? (row.attendee_emails as string[])
      : [],
    attendees: Array.isArray(row.attendees)
      ? (row.attendees as CloudMeetingPayload['attendees'])
      : [],
    folderIds: Array.isArray(row.folder_ids) ? (row.folder_ids as string[]) : [],
    enhancedNotes: typeof row.enhanced_notes === 'string' ? row.enhanced_notes : undefined,
    summary: typeof row.summary === 'string' ? row.summary : undefined,
    actionItems: Array.isArray(row.action_items) ? (row.action_items as string[]) : [],
  }
}

function meetingToRow(userId: string, meeting: CloudMeetingPayload) {
  return {
    user_id: userId,
    meeting_id: meeting.id,
    title: meeting.title,
    created_at_ms: meeting.createdAt,
    updated_at_ms: meeting.updatedAt,
    started_at_ms: meeting.startedAt ?? null,
    ended_at_ms: meeting.endedAt ?? null,
    status: meeting.status,
    user_notes: meeting.userNotes ?? '',
    transcript: meeting.transcript ?? [],
    speaker_labels: meeting.speakerLabels ?? {},
    speaker_identities: meeting.speakerIdentities ?? {},
    calendar_event_id: meeting.calendarEventId ?? null,
    calendar_provider: meeting.calendarProvider ?? null,
    scheduled_start_ms: meeting.scheduledStart ?? null,
    attendee_emails: meeting.attendeeEmails ?? [],
    attendees: meeting.attendees ?? [],
    folder_ids: meeting.folderIds ?? [],
    enhanced_notes: meeting.enhancedNotes ?? null,
    summary: meeting.summary ?? null,
    action_items: meeting.actionItems ?? [],
    synced_at: new Date().toISOString(),
  }
}

export async function listCloudMeetings(userId: string): Promise<CloudMeetingPayload[]> {
  const { data, error } = await admin()
    .from('user_meetings')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at_ms', { ascending: false })
    .limit(100)

  if (error) throw error
  return (data ?? []).map((row) => rowToMeeting(row as Record<string, unknown>))
}

export async function upsertCloudMeetings(
  userId: string,
  meetings: CloudMeetingPayload[],
): Promise<number> {
  if (meetings.length === 0) return 0
  const rows = meetings.map((meeting) => meetingToRow(userId, meeting))
  const { error } = await admin().from('user_meetings').upsert(rows, {
    onConflict: 'user_id,meeting_id',
  })
  if (error) throw error
  return rows.length
}

export async function deleteCloudMeetings(userId: string, meetingIds: string[]): Promise<number> {
  const ids = meetingIds.filter((id) => typeof id === 'string' && id.length > 0)
  if (ids.length === 0) return 0
  const { error, count } = await admin()
    .from('user_meetings')
    .delete({ count: 'exact' })
    .eq('user_id', userId)
    .in('meeting_id', ids)
  if (error) throw error
  return count ?? ids.length
}
