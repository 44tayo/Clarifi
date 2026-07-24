import fetch from 'node-fetch'

import type { StoredMeeting } from './meetingStore'
import {
  getMeeting,
  listMeetings,
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
  calendarEventId?: string
  calendarProvider?: 'google' | 'microsoft'
  scheduledStart?: number
  attendeeEmails?: string[]
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
    calendarEventId: meeting.calendarEventId,
    calendarProvider: meeting.calendarProvider,
    scheduledStart: meeting.scheduledStart,
    attendeeEmails: meeting.attendeeEmails,
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
    calendarEventId: remote.calendarEventId,
    calendarProvider: remote.calendarProvider,
    scheduledStart: remote.scheduledStart,
    attendeeEmails: remote.attendeeEmails,
    folderIds: remote.folderIds,
    enhancedNotes: remote.enhancedNotes,
    summary: remote.summary,
    actionItems: remote.actionItems,
  }
}

/** Last-write-wins merge by updatedAt. */
export function mergeMeetingsLww(
  local: SyncableMeeting[],
  remote: SyncableMeeting[],
): { toPush: SyncableMeeting[]; toPull: SyncableMeeting[] } {
  const localById = new Map(local.map((m) => [m.id, m]))
  const remoteById = new Map(remote.map((m) => [m.id, m]))
  const toPush: SyncableMeeting[] = []
  const toPull: SyncableMeeting[] = []

  const ids = new Set([...localById.keys(), ...remoteById.keys()])
  for (const id of ids) {
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

  return { toPush, toPull }
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
  if (meetings.length === 0) return { ok: true }
  const baseUrl = getClarifiApiUrl()
  const headers = await deviceHeaders()
  if (!baseUrl || !headers) return { ok: false, error: 'unauthorized' }

  try {
    const response = await fetch(`${baseUrl}/api/desktop/meetings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ meetings: meetings.map(toSyncable) }),
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

/** Pull remote + push local winners (last-write-wins by updatedAt). */
export async function syncMeetingsWithCloud(): Promise<{ ok: boolean; error?: string }> {
  if (syncInFlight) return { ok: true }
  syncInFlight = true
  try {
    const pulled = await pullMeetingsFromCloud()
    if (!pulled.ok) return { ok: false, error: pulled.error }

    const local = listMeetings().map(toSyncable)
    const remote = pulled.meetings ?? []
    const { toPush, toPull } = mergeMeetingsLww(local, remote)

    for (const meeting of toPull) {
      upsertMeetingSnapshot(fromSyncable(meeting))
    }

    if (toPush.length > 0) {
      const push = await pushMeetingsToCloud(
        toPush.map((m) => fromSyncable(m)),
      )
      if (!push.ok) return push
    }

    return { ok: true }
  } finally {
    syncInFlight = false
  }
}
