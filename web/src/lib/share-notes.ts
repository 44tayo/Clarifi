import { randomBytes } from 'crypto'

import {
  createCommunity,
  createItem,
  inviteToCommunity,
  listCommunitiesForUser,
} from '@/lib/communities'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export type SharedMeetingSnapshot = {
  id: string
  title: string
  summary?: string
  enhancedNotes?: string
  actionItems?: string[]
  userNotes?: string
  transcript?: Array<{ speaker: string; text: string; at?: number }>
  attendees?: string[]
  speakerLabels?: Record<string, string>
  endedAt?: number
  createdAt?: number
}

function admin() {
  const client = getSupabaseAdmin()
  if (!client) throw new Error('storage_unavailable')
  return client
}

function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://www.clarifiapp.com').replace(/\/$/, '')
}

async function ensurePersonalCommunity(userId: string): Promise<string> {
  const communities = await listCommunitiesForUser(userId)
  const existing = communities.find((c) => c.role === 'owner')
  if (existing) return existing.id
  const created = await createCommunity(userId, 'My shared notes')
  return created.id
}

export async function publishSharedMeeting(
  userId: string,
  meeting: SharedMeetingSnapshot,
): Promise<{ shareUrl: string; itemId: string; communityId: string; token: string }> {
  const communityId = await ensurePersonalCommunity(userId)
  const content = {
    summary: meeting.summary ?? null,
    enhancedNotes: meeting.enhancedNotes ?? null,
    actionItems: meeting.actionItems ?? [],
    userNotes: meeting.userNotes ?? '',
    transcript: meeting.transcript ?? [],
    attendees: meeting.attendees ?? [],
    speakerLabels: meeting.speakerLabels ?? {},
    endedAt: meeting.endedAt ?? null,
    createdAt: meeting.createdAt ?? null,
    sourceMeetingId: meeting.id,
  }

  const item = await createItem(userId, communityId, {
    type: 'meeting_recap',
    title: meeting.title,
    content,
    sourceSessionId: meeting.id,
  })

  const token = randomBytes(24).toString('hex')
  const { error } = await admin().from('shared_meeting_notes').insert({
    token,
    owner_user_id: userId,
    community_id: communityId,
    item_id: item.id,
    title: meeting.title,
    content,
  })

  if (error) throw error

  return {
    token,
    itemId: item.id,
    communityId,
    shareUrl: `${appOrigin()}/share/${token}`,
  }
}

export async function getSharedMeetingByToken(token: string): Promise<{
  title: string
  content: SharedMeetingSnapshot & Record<string, unknown>
  createdAt: string
} | null> {
  const { data, error } = await admin()
    .from('shared_meeting_notes')
    .select('title, content, created_at')
    .eq('token', token)
    .maybeSingle()

  if (error || !data) return null
  return {
    title: data.title as string,
    content: (data.content ?? {}) as SharedMeetingSnapshot & Record<string, unknown>,
    createdAt: data.created_at as string,
  }
}

export async function inviteToSharedCommunity(
  userId: string,
  communityId: string,
  email: string,
): Promise<void> {
  await inviteToCommunity(userId, communityId, email)
}
