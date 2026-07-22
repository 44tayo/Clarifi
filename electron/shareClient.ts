import fetch from 'node-fetch'

import { getDeviceCredentials } from './deviceAuth'
import { getClarifiApiUrl } from './keys'
import { getMeeting } from './meetingStore'

async function deviceHeaders(): Promise<Record<string, string> | null> {
  const creds = await getDeviceCredentials()
  if (!creds) return null
  return {
    'X-Clarifi-Device-Id': creds.deviceId,
    'X-Clarifi-Device-Secret': creds.deviceSecret,
  }
}

async function devicePost<T>(
  path: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const baseUrl = getClarifiApiUrl()
  const headers = await deviceHeaders()
  if (!baseUrl || !headers) {
    return { ok: false, status: 401, data: null }
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    })
    let data: T | null = null
    try {
      data = (await response.json()) as T
    } catch {
      data = null
    }
    return { ok: response.ok, status: response.status, data }
  } catch {
    return { ok: false, status: 0, data: null }
  }
}

async function deviceGet<T>(
  path: string,
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const baseUrl = getClarifiApiUrl()
  const headers = await deviceHeaders()
  if (!baseUrl || !headers) {
    return { ok: false, status: 401, data: null }
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      headers: { ...headers },
    })
    let data: T | null = null
    try {
      data = (await response.json()) as T
    } catch {
      data = null
    }
    return { ok: response.ok, status: response.status, data }
  } catch {
    return { ok: false, status: 0, data: null }
  }
}

export type SharePublishResult = {
  ok: boolean
  error?: string
  shareUrl?: string
  itemId?: string
  communityId?: string
}

export type SharedInboxInvite = {
  kind: 'invite'
  id: string
  communityId: string
  communityName: string
  token: string
  expiresAt: string
}

export type SharedInboxItem = {
  kind: 'item'
  id: string
  communityId: string
  communityName: string
  title: string
  type: string
  sharedBy: string
  sharedByLabel: string
  createdAt: string
  preview: string | null
}

export type SharedInboxEntry = SharedInboxInvite | SharedInboxItem

export type SharedItemDetail = {
  id: string
  communityId: string
  communityName: string
  folderId: string | null
  type: string
  title: string
  content: unknown
  sourceSessionId: string | null
  sharedBy: string
  sharedByLabel: string
  createdAt: string
}

export async function publishMeetingShare(meetingId: string): Promise<SharePublishResult> {
  const meeting = getMeeting(meetingId)
  if (!meeting) return { ok: false, error: 'meeting_not_found' }

  const { ok, status, data } = await devicePost<{
    error?: string
    shareUrl?: string
    itemId?: string
    communityId?: string
  }>('/api/desktop/share', {
    meeting: {
      id: meeting.id,
      title: meeting.title,
      summary: meeting.summary,
      enhancedNotes: meeting.enhancedNotes,
      actionItems: meeting.actionItems,
      userNotes: meeting.userNotes,
      transcript: meeting.transcript,
      attendees: meeting.attendeeEmails ?? [],
      speakerLabels: meeting.speakerLabels ?? {},
      endedAt: meeting.endedAt ?? meeting.startedAt ?? meeting.createdAt,
      createdAt: meeting.createdAt,
    },
  })

  if (status === 0) return { ok: false, error: 'network_error' }
  if (status === 401) return { ok: false, error: 'not_authenticated' }
  if (status === 403) return { ok: false, error: 'plan_required' }
  if (!ok || !data?.shareUrl) {
    return { ok: false, error: data?.error ?? 'share_failed' }
  }

  return {
    ok: true,
    shareUrl: data.shareUrl,
    itemId: data.itemId,
    communityId: data.communityId,
  }
}

export async function inviteToSharedMeeting(
  communityId: string,
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const { ok, status, data } = await devicePost<{ error?: string }>(
    `/api/desktop/share/invite`,
    { communityId, email },
  )
  if (status === 0) return { ok: false, error: 'network_error' }
  if (status === 401) return { ok: false, error: 'not_authenticated' }
  if (status === 403) return { ok: false, error: 'plan_required' }
  if (!ok) return { ok: false, error: data?.error ?? 'invite_failed' }
  return { ok: true }
}

export async function listSharedWithMe(): Promise<{
  ok: boolean
  error?: string
  planRequired?: boolean
  entries?: SharedInboxEntry[]
}> {
  const { ok, status, data } = await deviceGet<{
    error?: string
    planRequired?: boolean
    entries?: SharedInboxEntry[]
  }>('/api/desktop/shared-with-me')

  if (status === 0) return { ok: false, error: 'network_error' }
  if (status === 401) return { ok: false, error: 'not_authenticated' }
  if (!ok || !data) return { ok: false, error: data?.error ?? 'list_failed' }
  return {
    ok: true,
    planRequired: Boolean(data.planRequired),
    entries: Array.isArray(data.entries) ? data.entries : [],
  }
}

export async function getSharedWithMeItem(
  communityId: string,
  itemId: string,
): Promise<{ ok: boolean; error?: string; item?: SharedItemDetail }> {
  const qs = new URLSearchParams({ communityId, itemId }).toString()
  const { ok, status, data } = await deviceGet<{ error?: string; item?: SharedItemDetail }>(
    `/api/desktop/shared-with-me/item?${qs}`,
  )

  if (status === 0) return { ok: false, error: 'network_error' }
  if (status === 401) return { ok: false, error: 'not_authenticated' }
  if (status === 403) return { ok: false, error: data?.error ?? 'plan_required' }
  if (!ok || !data?.item) return { ok: false, error: data?.error ?? 'not_found' }
  return { ok: true, item: data.item }
}

export async function acceptSharedInvite(
  token: string,
): Promise<{ ok: boolean; error?: string; communityId?: string }> {
  const { ok, status, data } = await devicePost<{ error?: string; communityId?: string }>(
    '/api/desktop/shared-with-me/accept',
    { token },
  )
  if (status === 0) return { ok: false, error: 'network_error' }
  if (status === 401) return { ok: false, error: 'not_authenticated' }
  if (status === 403) return { ok: false, error: 'plan_required' }
  if (!ok) return { ok: false, error: data?.error ?? 'accept_failed' }
  return { ok: true, communityId: data?.communityId }
}
