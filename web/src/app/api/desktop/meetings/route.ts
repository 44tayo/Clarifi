import { getUserIdFromDeviceRequest } from '@/lib/device-auth'
import {
  deleteCloudMeetings,
  listCloudMeetings,
  upsertCloudMeetings,
  type CloudMeetingPayload,
} from '@/lib/user-meetings'

function parseMeeting(raw: unknown): CloudMeetingPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Record<string, unknown>
  if (typeof m.id !== 'string' || typeof m.title !== 'string') return null
  if (typeof m.createdAt !== 'number' || typeof m.updatedAt !== 'number') return null
  return {
    id: m.id,
    title: m.title,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    startedAt: typeof m.startedAt === 'number' ? m.startedAt : undefined,
    endedAt: typeof m.endedAt === 'number' ? m.endedAt : undefined,
    status: typeof m.status === 'string' ? m.status : 'ready',
    userNotes: typeof m.userNotes === 'string' ? m.userNotes : '',
    transcript: Array.isArray(m.transcript) ? m.transcript : [],
    speakerLabels:
      m.speakerLabels && typeof m.speakerLabels === 'object'
        ? (m.speakerLabels as Record<string, string>)
        : {},
    speakerIdentities:
      m.speakerIdentities && typeof m.speakerIdentities === 'object'
        ? (m.speakerIdentities as CloudMeetingPayload['speakerIdentities'])
        : {},
    calendarEventId: typeof m.calendarEventId === 'string' ? m.calendarEventId : undefined,
    calendarProvider: typeof m.calendarProvider === 'string' ? m.calendarProvider : undefined,
    scheduledStart: typeof m.scheduledStart === 'number' ? m.scheduledStart : undefined,
    attendeeEmails: Array.isArray(m.attendeeEmails)
      ? m.attendeeEmails.filter((v): v is string => typeof v === 'string')
      : [],
    attendees: Array.isArray(m.attendees)
      ? (m.attendees as CloudMeetingPayload['attendees'])
      : [],
    folderIds: Array.isArray(m.folderIds)
      ? m.folderIds.filter((v): v is string => typeof v === 'string')
      : [],
    enhancedNotes: typeof m.enhancedNotes === 'string' ? m.enhancedNotes : undefined,
    summary: typeof m.summary === 'string' ? m.summary : undefined,
    actionItems: Array.isArray(m.actionItems)
      ? m.actionItems.filter((v): v is string => typeof v === 'string')
      : [],
  }
}

export async function GET(req: Request) {
  const userId = await getUserIdFromDeviceRequest(req)
  if (!userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const meetings = await listCloudMeetings(userId)
    return Response.json({ ok: true, meetings })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'list_failed'
    const status = message === 'storage_unavailable' ? 503 : 500
    return Response.json({ error: message }, { status })
  }
}

export async function POST(req: Request) {
  const userId = await getUserIdFromDeviceRequest(req)
  if (!userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const rawMeetings = (body as { meetings?: unknown })?.meetings
  if (!Array.isArray(rawMeetings)) {
    return Response.json({ error: 'meetings_required' }, { status: 400 })
  }

  const meetings = rawMeetings
    .map(parseMeeting)
    .filter((m): m is CloudMeetingPayload => Boolean(m))
    .slice(0, 100)

  try {
    const count = await upsertCloudMeetings(userId, meetings)
    return Response.json({ ok: true, upserted: count })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'upsert_failed'
    const status = message === 'storage_unavailable' ? 503 : 500
    return Response.json({ error: message }, { status })
  }
}

export async function DELETE(req: Request) {
  const userId = await getUserIdFromDeviceRequest(req)
  if (!userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const rawIds = (body as { ids?: unknown })?.ids
  if (!Array.isArray(rawIds)) {
    return Response.json({ error: 'ids_required' }, { status: 400 })
  }

  const ids = rawIds
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .slice(0, 100)

  try {
    const deleted = await deleteCloudMeetings(userId, ids)
    return Response.json({ ok: true, deleted })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'delete_failed'
    const status = message === 'storage_unavailable' ? 503 : 500
    return Response.json({ error: message }, { status })
  }
}
