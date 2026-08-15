import { randomBytes } from 'crypto'

import {
  createCommunity,
  createItem,
  inviteToCommunity,
  listCommunitiesForUser,
} from '@/lib/communities'
import { getDesktopUserProfile } from '@/lib/desktop-profile'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendSharedNoteEmail, buildSharedNoteEmailText, sharedNoteEmailSubject } from '@/lib/share-email'
import {
  isShareViewerAuthorized,
  normalizeShareLinkAccess,
  shareUrlForToken,
  snapshotSharedMeetingContent,
  type ShareLinkAccess,
  type SharedMeetingSnapshotInput,
} from '@/lib/share-link'

export type SharedMeetingSnapshot = SharedMeetingSnapshotInput
export type LinkAccess = ShareLinkAccess

function admin() {
  const client = getSupabaseAdmin()
  if (!client) throw Object.assign(new Error('storage_unavailable'), { code: 'storage_unavailable' })
  return client
}

function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://www.clarifiapp.com').replace(/\/$/, '')
}

function formatMeetingWhen(endedAt: unknown): string | null {
  if (typeof endedAt !== 'number' || !Number.isFinite(endedAt)) return null
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date(endedAt))
  } catch {
    return null
  }
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
  linkAccess: LinkAccess = 'anyone',
): Promise<{ shareUrl: string; itemId: string; communityId: string; token: string }> {
  const communityId = await ensurePersonalCommunity(userId)
  const content = snapshotSharedMeetingContent(meeting)
  const access = normalizeShareLinkAccess(linkAccess)

  // Reuse an existing public token for this meeting so Copy link stays stable.
  const { data: existing, error: existingError } = await admin()
    .from('shared_meeting_notes')
    .select('token, item_id, community_id')
    .eq('owner_user_id', userId)
    .eq('content->>sourceMeetingId', meeting.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingError) throw existingError

  if (existing?.token) {
    const { error: updateError } = await admin()
      .from('shared_meeting_notes')
      .update({
        title: meeting.title,
        content,
        community_id: communityId,
        // Every (re-)publish syncs the current access mode server-side so a
        // toggle change actually takes effect on the already-issued link.
        link_access: access,
      })
      .eq('token', existing.token)
      .eq('owner_user_id', userId)

    if (updateError) throw updateError

    return {
      token: existing.token,
      itemId: existing.item_id ?? '',
      communityId: existing.community_id ?? communityId,
      shareUrl: shareUrlForToken(existing.token, appOrigin()),
    }
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
    link_access: access,
  })

  if (error) throw error

  return {
    token,
    itemId: item.id,
    communityId,
    shareUrl: shareUrlForToken(token, appOrigin()),
  }
}

/** Owner view: current share link + who has been invited for this meeting. */
export async function getSharedMeetingAccess(
  userId: string,
  meetingId: string,
): Promise<{
  shareUrl: string | null
  communityId: string | null
  itemId: string | null
  linkAccess: LinkAccess
  invitedEmails: string[]
} | null> {
  const { data, error } = await admin()
    .from('shared_meeting_notes')
    .select('token, item_id, community_id, link_access, invited_emails')
    .eq('owner_user_id', userId)
    .eq('content->>sourceMeetingId', meetingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    return {
      shareUrl: null,
      communityId: null,
      itemId: null,
      linkAccess: 'anyone',
      invitedEmails: [],
    }
  }

  const invitedEmails = (Array.isArray(data.invited_emails) ? data.invited_emails : [])
    .filter((email): email is string => typeof email === 'string' && Boolean(email.trim()))
    .map((email) => email.trim().toLowerCase())

  return {
    shareUrl: data.token ? shareUrlForToken(data.token as string, appOrigin()) : null,
    communityId: (data.community_id as string | null) ?? null,
    itemId: (data.item_id as string | null) ?? null,
    linkAccess: normalizeShareLinkAccess(data.link_access),
    invitedEmails,
  }
}

/**
 * Fetch a shared note by its public token, enforcing link_access server-side.
 *
 * When link_access is 'invited', the content is withheld from anyone whose
 * email isn't the owner or on the invited list — including anonymous
 * (signed-out) requests. Unauthorized/unknown tokens both resolve to `null`
 * so callers can render one indistinguishable "not found" state rather than
 * leaking whether a private token exists.
 */
export async function getSharedMeetingByToken(
  token: string,
  requesterEmail?: string | null,
): Promise<{
  title: string
  content: SharedMeetingSnapshot & Record<string, unknown>
  createdAt: string
} | null> {
  const { data, error } = await admin()
    .from('shared_meeting_notes')
    .select('title, content, created_at, owner_user_id, link_access, invited_emails')
    .eq('token', token)
    .maybeSingle()

  if (error || !data) return null

  const linkAccess = normalizeShareLinkAccess(data.link_access)
  if (linkAccess === 'invited') {
    const invitedEmails = (Array.isArray(data.invited_emails) ? data.invited_emails : []).filter(
      (email): email is string => typeof email === 'string',
    )
    const ownerEmail = await getOwnerEmail(data.owner_user_id as string)

    const authorized = isShareViewerAuthorized({
      linkAccess,
      ownerEmail,
      invitedEmails,
      requesterEmail,
    })
    if (!authorized) return null
  }

  return {
    title: data.title as string,
    content: (data.content ?? {}) as SharedMeetingSnapshot & Record<string, unknown>,
    createdAt: data.created_at as string,
  }
}

async function getOwnerEmail(ownerUserId: string): Promise<string | null> {
  const { data } = await admin()
    .from('profiles')
    .select('email')
    .eq('user_id', ownerUserId)
    .maybeSingle()
  return (data?.email as string | undefined) ?? null
}

/** Add an email to a share's invited allowlist (dedup, case-insensitive). */
async function addInvitedEmail(token: string, email: string): Promise<void> {
  const normalized = email.trim().toLowerCase()
  const { data, error } = await admin()
    .from('shared_meeting_notes')
    .select('invited_emails')
    .eq('token', token)
    .maybeSingle()

  if (error || !data) return

  const existing = (Array.isArray(data.invited_emails) ? data.invited_emails : [])
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.toLowerCase())

  if (existing.includes(normalized)) return

  await admin()
    .from('shared_meeting_notes')
    .update({ invited_emails: [...existing, normalized] })
    .eq('token', token)
}

/**
 * Email a recipient the public share link (same URL as Copy link).
 * Does not require the recipient to have a Clarifi account.
 * Best-effort: also creates a community invite when the recipient is a Pro+ Clarifi user.
 *
 * When Resend is not configured, returns `delivery: 'compose'` so the desktop can open mailto.
 */
export async function inviteToSharedCommunity(
  userId: string,
  communityId: string,
  email: string,
  meetingId: string,
): Promise<{
  shareUrl: string
  email: string
  subject: string
  text: string
  delivery: 'resend' | 'compose'
}> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw Object.assign(new Error('invalid_email'), { code: 'invalid_email' })
  }
  if (!meetingId.trim()) {
    throw Object.assign(new Error('meeting_required'), { code: 'meeting_required' })
  }

  const { data: shared, error } = await admin()
    .from('shared_meeting_notes')
    .select('token, title, content, community_id')
    .eq('owner_user_id', userId)
    .eq('content->>sourceMeetingId', meetingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!shared?.token) {
    throw Object.assign(new Error('share_not_found'), { code: 'share_not_found' })
  }

  await addInvitedEmail(shared.token, normalizedEmail)

  const content = (shared.content ?? {}) as Record<string, unknown>
  const attendees = Array.isArray(content.attendees)
    ? content.attendees.filter((item): item is string => typeof item === 'string')
    : []
  const shareUrl = shareUrlForToken(shared.token, appOrigin())
  const meetingTitle = typeof shared.title === 'string' ? shared.title : 'Untitled meeting'

  const profile = await getDesktopUserProfile(userId)
  const sharerName =
    profile?.fullName?.trim() ||
    profile?.firstName?.trim() ||
    profile?.email?.split('@')[0] ||
    'Someone'

  const emailParams = {
    email: normalizedEmail,
    sharerName,
    meetingTitle,
    shareUrl,
    attendeesCount: attendees.length,
    meetingWhen: formatMeetingWhen(content.endedAt),
    marketingUrl: `${appOrigin()}/`,
  }
  const subject = sharedNoteEmailSubject(meetingTitle)
  const text = buildSharedNoteEmailText(emailParams)

  let delivery: 'resend' | 'compose' = 'resend'
  try {
    await sendSharedNoteEmail(emailParams)
  } catch (err) {
    const code = (err as { code?: string }).code
    // Only open the user's mail app when Resend is not configured at all.
    // Delivery failures (bad recipient, domain issues, etc.) must surface as errors.
    if (code === 'email_not_configured') {
      delivery = 'compose'
    } else {
      throw err
    }
  }

  const inviteCommunityId =
    (typeof shared.community_id === 'string' && shared.community_id) || communityId
  try {
    await inviteToCommunity(userId, inviteCommunityId, normalizedEmail, { skipEmail: true })
  } catch (err) {
    const code = (err as { code?: string }).code
    if (
      code !== 'invite_requires_pro_plus' &&
      code !== 'already_member' &&
      code !== 'invalid_email'
    ) {
      console.warn('[share-invite] community invite skipped:', code ?? err)
    }
  }

  return {
    shareUrl,
    email: normalizedEmail,
    subject,
    text,
    delivery,
  }
}
