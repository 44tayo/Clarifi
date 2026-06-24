import fetch from 'node-fetch'
import { getDeviceCredentials } from './deviceAuth'
import { getClarifiApiUrl } from './keys'
import type { StoredAudioSession } from './audioSessionHistory'

async function deviceHeaders(): Promise<Record<string, string> | null> {
  const creds = await getDeviceCredentials()
  if (!creds) return null
  return {
    'X-Clarifi-Device-Id': creds.deviceId,
    'X-Clarifi-Device-Secret': creds.deviceSecret,
  }
}

async function communityRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const baseUrl = getClarifiApiUrl()
  const headers = await deviceHeaders()
  if (!baseUrl || !headers) {
    return { ok: false, status: 401, data: null }
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  let data: T | null = null
  try {
    data = (await response.json()) as T
  } catch {
    data = null
  }

  return { ok: response.ok, status: response.status, data }
}

export async function listCommunities() {
  return communityRequest<{
    communities?: unknown[]
    invites?: unknown[]
    error?: string
  }>('GET', '/api/communities')
}

export async function createCommunity(name: string) {
  return communityRequest<{ community?: unknown; error?: string }>('POST', '/api/communities', {
    name,
  })
}

export async function getCommunityDetail(id: string) {
  return communityRequest<{ community?: unknown; members?: unknown[]; error?: string }>(
    'GET',
    `/api/communities/${id}`,
  )
}

export async function inviteToCommunity(id: string, email: string) {
  return communityRequest<{ inviteId?: string; error?: string }>(
    'POST',
    `/api/communities/${id}/invite`,
    { email },
  )
}

export async function acceptCommunityInvite(communityId: string, token: string) {
  return communityRequest<{ communityId?: string; error?: string }>(
    'POST',
    `/api/communities/${communityId}/invites/accept`,
    { token },
  )
}

export async function listCommunityFolders(communityId: string) {
  return communityRequest<{ folders?: unknown[]; error?: string }>(
    'GET',
    `/api/communities/${communityId}/folders`,
  )
}

export async function createCommunityFolder(
  communityId: string,
  name: string,
  parentId?: string | null,
) {
  return communityRequest<{ folder?: unknown; error?: string }>(
    'POST',
    `/api/communities/${communityId}/folders`,
    { name, parentId },
  )
}

export async function listCommunityItems(communityId: string, folderId?: string | null) {
  const query = folderId ? `?folderId=${encodeURIComponent(folderId)}` : ''
  return communityRequest<{ items?: unknown[]; error?: string }>(
    'GET',
    `/api/communities/${communityId}/items${query}`,
  )
}

export async function shareSessionToCommunity(payload: {
  communityId: string
  folderId: string | null
  sessionId: string
  includeRecap: boolean
  includeTranscript: boolean
  includeNotes: boolean
}): Promise<{ ok: boolean; error?: string; itemsCreated?: number }> {
  const session = await import('./audioSessionHistory').then((m) =>
    m.getAudioSessionById(payload.sessionId),
  )
  if (!session) return { ok: false, error: 'session_not_found' }

  let itemsCreated = 0
  const tasks: Array<Promise<{ ok: boolean; status: number }>> = []

  if (payload.includeRecap && session.recap) {
    tasks.push(
      communityRequest('POST', `/api/communities/${payload.communityId}/items`, {
        folderId: payload.folderId,
        type: 'meeting_recap',
        title: `${session.title} — Recap`,
        content: session.recap,
        sourceSessionId: session.id,
      }).then((r) => ({ ok: r.ok, status: r.status })),
    )
  }

  if (payload.includeTranscript && session.transcript.length > 0) {
    tasks.push(
      communityRequest('POST', `/api/communities/${payload.communityId}/items`, {
        folderId: payload.folderId,
        type: 'transcript',
        title: `${session.title} — Transcript`,
        content: session.transcript,
        sourceSessionId: session.id,
      }).then((r) => ({ ok: r.ok, status: r.status })),
    )
  }

  if (payload.includeNotes) {
    const notes =
      session.recap?.recapEmailDraft?.trim() ||
      session.chatMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n\n')

    if (notes) {
      tasks.push(
        communityRequest('POST', `/api/communities/${payload.communityId}/items`, {
          folderId: payload.folderId,
          type: 'note',
          title: `${session.title} — Notes`,
          content: { text: notes, chatMessages: session.chatMessages },
          sourceSessionId: session.id,
        }).then((r) => ({ ok: r.ok, status: r.status })),
      )
    }
  }

  if (tasks.length === 0) return { ok: false, error: 'nothing_to_share' }

  const results = await Promise.all(tasks)
  itemsCreated = results.filter((r) => r.ok).length

  if (itemsCreated === 0) {
    const failed = results[0]
    if (failed?.status === 403) return { ok: false, error: 'plan_required' }
    return { ok: false, error: 'share_failed' }
  }

  return { ok: true, itemsCreated }
}

export type { StoredAudioSession }
