import fetch from 'node-fetch'

import type { MeetingAttendee, SpeakerIdentities } from '../shared/speakers'
import type { StoredMeeting } from './meetingStore'
import {
  getMeeting,
  listDeletedMeetingIds,
  listMeetings,
  purgeTombstonedLocalMeetings,
  upsertMeetingSnapshot,
} from './meetingStore'
import { getDeviceCredentials } from './deviceAuth'
import { getClarifiApiUrl } from './keys'

export type SyncableMeeting = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  startedAt?: number
  endedAt?: number
  status: string
  userNotes: string
  transcript: StoredMeeting['transcript']
  speakerLabels?: Record<string, string>
  speakerIdentities?: SpeakerIdentities
  calendarEventId?: string
  calendarProvider?: 'google' | 'microsoft'
  scheduledStart?: number
  attendeeEmails?: string[]
  attendees?: MeetingAttendee[]
  folderIds?: string[]
  enhancedNotes?: string
  summary?: string
  actionItems?: string[]
}

export function meetingUpdatedAt(
  meeting: Pick<StoredMeeting, 'updatedAt' | 'endedAt' | 'createdAt'>,
): number {
  return meeting.updatedAt ?? meeting.endedAt ?? meeting.createdAt
}

export function toSyncable(meeting: StoredMeeting): SyncableMeeting {
  return {
    id: meeting.id,
    title: meeting.title,
    createdAt: meeting.createdAt,
    updatedAt: meetingUpdatedAt(meeting),
    startedAt: meeting.startedAt,
    endedAt: meeting.endedAt,
    status: meeting.status,
    userNotes: meeting.userNotes,
    transcript: meeting.transcript,
    speakerLabels: meeting.speakerLabels,
    speakerIdentities: meeting.speakerIdentities,
    calendarEventId: meeting.calendarEventId,
    calendarProvider: meeting.calendarProvider,
    scheduledStart: meeting.scheduledStart,
    attendeeEmails: meeting.attendeeEmails,
    attendees: meeting.attendees,
    folderIds: meeting.folderIds,
    enhancedNotes: meeting.enhancedNotes,
    summary: meeting.summary,
    actionItems: meeting.actionItems,
  }
}

function fromSyncable(remote: SyncableMeeting): StoredMeeting {
  return {
    id: remote.id,
    title: remote.title,
    createdAt: remote.createdAt,
    updatedAt: remote.updatedAt,
    startedAt: remote.startedAt,
    endedAt: remote.endedAt,
    status: (remote.status as StoredMeeting['status']) || 'ready',
    userNotes: remote.userNotes,
    transcript: remote.transcript ?? [],
    speakerLabels: remote.speakerLabels,
    speakerIdentities: remote.speakerIdentities,
    calendarEventId: remote.calendarEventId,
    calendarProvider: remote.calendarProvider,
    scheduledStart: remote.scheduledStart,
    attendeeEmails: remote.attendeeEmails,
    attendees: remote.attendees,
    folderIds: remote.folderIds,
    enhancedNotes: remote.enhancedNotes,
    summary: remote.summary,
    actionItems: remote.actionItems,
  }
}

/** Last-write-wins merge by updatedAt. Respects local deletions so notes stay gone. */
export function mergeMeetingsLww(
  local: SyncableMeeting[],
  remote: SyncableMeeting[],
  deletedIds: Iterable<string> = [],
): { toPush: SyncableMeeting[]; toPull: SyncableMeeting[]; toDeleteRemote: string[] } {
  const deleted = new Set(deletedIds)
  const localById = new Map(local.map((m) => [m.id, m]))
  const remoteById = new Map(remote.map((m) => [m.id, m]))
  const toPush: SyncableMeeting[] = []
  const toPull: SyncableMeeting[] = []
  const toDeleteRemote: string[] = []

  const ids = new Set([...localById.keys(), ...remoteById.keys(), ...deleted])
  for (const id of ids) {
    if (deleted.has(id)) {
      if (remoteById.has(id)) toDeleteRemote.push(id)
      continue
    }
    const l = localById.get(id)
    const r = remoteById.get(id)
    if (l && !r) {
      toPush.push(l)
      continue
    }
    if (r && !l) {
      toPull.push(r)
      continue
    }
    if (l && r) {
      if (l.updatedAt >= r.updatedAt) toPush.push(l)
      else toPull.push(r)
    }
  }

  return { toPush, toPull, toDeleteRemote }
}

async function deviceHeaders(): Promise<Record<string, string> | null> {
  const creds = await getDeviceCredentials()
  if (!creds) return null
  return {
    'X-Clarifi-Device-Id': creds.deviceId,
    'X-Clarifi-Device-Secret': creds.deviceSecret,
    'Content-Type': 'application/json',
  }
}

export async function pushMeetingsToCloud(
  meetings: StoredMeeting[],
): Promise<{ ok: boolean; error?: string }> {
  const deleted = new Set(listDeletedMeetingIds())
  const payload = meetings.filter((meeting) => !deleted.has(meeting.id))
  if (payload.length === 0) return { ok: true }
  const baseUrl = getClarifiApiUrl()
  const headers = await deviceHeaders()
  if (!baseUrl || !headers) return { ok: false, error: 'unauthorized' }

  try {
    const response = await fetch(`${baseUrl}/api/desktop/meetings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ meetings: payload.map(toSyncable) }),
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      return { ok: false, error: data?.error || 'push_failed' }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'network_error' }
  }
}

export async function pushMeetingToCloud(
  meetingId: string,
): Promise<{ ok: boolean; error?: string }> {
  const meeting = getMeeting(meetingId)
  if (!meeting) return { ok: false, error: 'not_found' }
  return pushMeetingsToCloud([meeting])
}

export async function deleteMeetingsFromCloud(
  meetingIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  const ids = meetingIds.filter((id) => typeof id === 'string' && id.length > 0)
  if (ids.length === 0) return { ok: true }
  const baseUrl = getClarifiApiUrl()
  const headers = await deviceHeaders()
  if (!baseUrl || !headers) return { ok: false, error: 'unauthorized' }

  try {
    const response = await fetch(`${baseUrl}/api/desktop/meetings`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ ids }),
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      return { ok: false, error: data?.error || 'delete_failed' }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'network_error' }
  }
}

export async function deleteMeetingFromCloud(
  meetingId: string,
): Promise<{ ok: boolean; error?: string }> {
  return deleteMeetingsFromCloud([meetingId])
}

export async function pullMeetingsFromCloud(): Promise<{
  ok: boolean
  meetings?: SyncableMeeting[]
  error?: string
}> {
  const baseUrl = getClarifiApiUrl()
  const headers = await deviceHeaders()
  if (!baseUrl || !headers) return { ok: false, error: 'unauthorized' }

  try {
    const response = await fetch(`${baseUrl}/api/desktop/meetings`, { headers })
    const data = (await response.json().catch(() => null)) as {
      ok?: boolean
      meetings?: SyncableMeeting[]
      error?: string
    } | null
    if (!response.ok || !data?.ok) {
      return { ok: false, error: data?.error || 'pull_failed' }
    }
    return { ok: true, meetings: Array.isArray(data.meetings) ? data.meetings : [] }
  } catch {
    return { ok: false, error: 'network_error' }
  }
}

let syncInFlight = false

/** Pull remote + push local winners (last-write-wins by updatedAt).
 * Deleted meeting ids are permanent tombstones — never pulled back, never forgotten. */
export async function syncMeetingsWithCloud(): Promise<{ ok: boolean; error?: string }> {
  if (syncInFlight) return { ok: true }
  syncInFlight = true
  try {
    purgeTombstonedLocalMeetings()

    const pulled = await pullMeetingsFromCloud()
    if (!pulled.ok) return { ok: false, error: pulled.error }

    const local = listMeetings().map(toSyncable)
    const remote = pulled.meetings ?? []
    const deletedIds = listDeletedMeetingIds()
    const { toPush, toPull, toDeleteRemote } = mergeMeetingsLww(local, remote, deletedIds)

    for (const meeting of toPull) {
      upsertMeetingSnapshot(fromSyncable(meeting))
    }

    // Keep tombstones forever. Re-delete from cloud whenever a deleted id still appears remote.
    if (toDeleteRemote.length > 0) {
      await deleteMeetingsFromCloud(toDeleteRemote)
    }

    if (toPush.length > 0) {
      const push = await pushMeetingsToCloud(
        toPush.map((m) => fromSyncable(m)),
      )
      if (!push.ok) return push
    }

    // Belt-and-suspenders: anything tombstoned that slipped into local during pull.
    purgeTombstonedLocalMeetings()

    return { ok: true }
  } finally {
    syncInFlight = false
  }
}
