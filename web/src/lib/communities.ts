import { randomBytes } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getUserPlan } from '@/lib/usage'
import { hasFeature } from '@/lib/entitlements'
import { sendCommunityInviteEmail } from '@/lib/community-email'

export type CommunityRole = 'owner' | 'member'

export type CommunitySummary = {
  id: string
  name: string
  role: CommunityRole
  memberCount: number
}

export type CommunityMember = {
  userId: string
  email: string | null
  role: CommunityRole
  status: string
}

export type CommunityFolder = {
  id: string
  communityId: string
  parentId: string | null
  name: string
  sortOrder: number
}

export type CommunityItemType = 'meeting_recap' | 'transcript' | 'note'

export type CommunityItem = {
  id: string
  communityId: string
  folderId: string | null
  type: CommunityItemType
  title: string
  content: unknown
  sourceSessionId: string | null
  sharedBy: string
  createdAt: string
}

export type CommunityInvite = {
  id: string
  communityId: string
  communityName: string
  email: string
  status: string
  token: string
  expiresAt: string
}

function admin() {
  const client = getSupabaseAdmin()
  if (!client) throw new Error('storage_unavailable')
  return client
}

async function requireProPlus(userId: string): Promise<void> {
  const plan = await getUserPlan(userId)
  if (!hasFeature(plan, 'communities')) {
    throw Object.assign(new Error('plan_required'), { code: 'plan_required' })
  }
}

async function getMemberRole(
  communityId: string,
  userId: string,
): Promise<CommunityRole | null> {
  const { data } = await admin()
    .from('community_members')
    .select('role, status')
    .eq('community_id', communityId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!data || data.status !== 'active') return null
  return data.role as CommunityRole
}

async function assertMember(communityId: string, userId: string): Promise<CommunityRole> {
  const role = await getMemberRole(communityId, userId)
  if (!role) throw Object.assign(new Error('not_a_member'), { code: 'not_a_member' })
  return role
}

async function assertOwner(communityId: string, userId: string): Promise<void> {
  const role = await assertMember(communityId, userId)
  if (role !== 'owner') throw Object.assign(new Error('owner_required'), { code: 'owner_required' })
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  const { data: profile } = await admin()
    .from('profiles')
    .select('user_id')
    .ilike('email', normalized)
    .maybeSingle()

  if (profile?.user_id) return profile.user_id

  const { data: authData, error } = await admin().auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) return null
  const match = authData.users.find((u) => u.email?.toLowerCase() === normalized)
  return match?.id ?? null
}

export async function listCommunitiesForUser(userId: string): Promise<CommunitySummary[]> {
  await requireProPlus(userId)

  const { data: memberships, error } = await admin()
    .from('community_members')
    .select('community_id, role, communities(id, name)')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (error) throw error

  const results: CommunitySummary[] = []
  for (const row of memberships ?? []) {
    const communityRaw = row.communities as unknown
    const community = Array.isArray(communityRaw)
      ? (communityRaw[0] as { id: string; name: string } | undefined)
      : (communityRaw as { id: string; name: string } | null)
    if (!community) continue

    const { count } = await admin()
      .from('community_members')
      .select('*', { count: 'exact', head: true })
      .eq('community_id', community.id)
      .eq('status', 'active')

    results.push({
      id: community.id,
      name: community.name,
      role: row.role as CommunityRole,
      memberCount: count ?? 1,
    })
  }

  return results
}

export async function createCommunity(userId: string, name: string): Promise<CommunitySummary> {
  await requireProPlus(userId)
  const trimmed = name.trim()
  if (!trimmed) throw Object.assign(new Error('name_required'), { code: 'name_required' })

  const { data: community, error } = await admin()
    .from('communities')
    .insert({ name: trimmed, owner_user_id: userId })
    .select('id, name')
    .single()

  if (error || !community) throw error ?? new Error('create_failed')

  const { error: memberError } = await admin().from('community_members').insert({
    community_id: community.id,
    user_id: userId,
    role: 'owner',
    status: 'active',
  })

  if (memberError) throw memberError

  const { error: folderError } = await admin().from('community_folders').insert({
    community_id: community.id,
    parent_id: null,
    name: 'General',
    sort_order: 0,
  })

  if (folderError) throw folderError

  return {
    id: community.id,
    name: community.name,
    role: 'owner',
    memberCount: 1,
  }
}

export async function getCommunityDetail(
  userId: string,
  communityId: string,
): Promise<{ community: CommunitySummary; members: CommunityMember[] }> {
  await assertMember(communityId, userId)

  const { data: community, error } = await admin()
    .from('communities')
    .select('id, name')
    .eq('id', communityId)
    .single()

  if (error || !community) throw error ?? new Error('not_found')

  const role = await getMemberRole(communityId, userId)

  const { data: members, error: membersError } = await admin()
    .from('community_members')
    .select('user_id, role, status')
    .eq('community_id', communityId)
    .eq('status', 'active')

  if (membersError) throw membersError

  const memberList: CommunityMember[] = []
  for (const m of members ?? []) {
    const { data: profile } = await admin()
      .from('profiles')
      .select('email')
      .eq('user_id', m.user_id)
      .maybeSingle()

    memberList.push({
      userId: m.user_id,
      email: profile?.email ?? null,
      role: m.role as CommunityRole,
      status: m.status,
    })
  }

  return {
    community: {
      id: community.id,
      name: community.name,
      role: role ?? 'member',
      memberCount: memberList.length,
    },
    members: memberList,
  }
}

export async function inviteToCommunity(
  userId: string,
  communityId: string,
  email: string,
): Promise<{ inviteId: string; token: string }> {
  await requireProPlus(userId)
  await assertOwner(communityId, userId)

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw Object.assign(new Error('invalid_email'), { code: 'invalid_email' })
  }

  const inviteeId = await findUserIdByEmail(normalizedEmail)
  if (!inviteeId) {
    throw Object.assign(new Error('invite_requires_pro_plus'), { code: 'invite_requires_pro_plus' })
  }

  const inviteePlan = await getUserPlan(inviteeId)
  if (!hasFeature(inviteePlan, 'communities')) {
    throw Object.assign(new Error('invite_requires_pro_plus'), { code: 'invite_requires_pro_plus' })
  }

  const existing = await admin()
    .from('community_members')
    .select('status')
    .eq('community_id', communityId)
    .eq('user_id', inviteeId)
    .maybeSingle()

  if (existing.data?.status === 'active') {
    throw Object.assign(new Error('already_member'), { code: 'already_member' })
  }

  const token = randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: invite, error } = await admin()
    .from('community_invites')
    .insert({
      community_id: communityId,
      email: normalizedEmail,
      invited_by: userId,
      token,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (error || !invite) throw error ?? new Error('invite_failed')

  const { data: community } = await admin()
    .from('communities')
    .select('name')
    .eq('id', communityId)
    .single()

  await sendCommunityInviteEmail({
    email: normalizedEmail,
    communityName: community?.name ?? 'Community',
    token,
  })

  return { inviteId: invite.id, token }
}

export async function listPendingInvitesForUser(userId: string): Promise<CommunityInvite[]> {
  await requireProPlus(userId)

  const { data: profile } = await admin()
    .from('profiles')
    .select('email')
    .eq('user_id', userId)
    .maybeSingle()

  const email = profile?.email?.toLowerCase()
  if (!email) return []

  const { data: invites, error } = await admin()
    .from('community_invites')
    .select('id, community_id, email, status, token, expires_at, communities(name)')
    .eq('status', 'pending')
    .ilike('email', email)
    .gt('expires_at', new Date().toISOString())

  if (error) throw error

  return (invites ?? []).map((row) => ({
    id: row.id,
    communityId: row.community_id,
    communityName: (() => {
      const raw = row.communities as unknown
      const community = Array.isArray(raw)
        ? (raw[0] as { name?: string } | undefined)
        : (raw as { name?: string } | null)
      return community?.name ?? 'Community'
    })(),
    email: row.email,
    status: row.status,
    token: row.token,
    expiresAt: row.expires_at,
  }))
}

export async function acceptCommunityInvite(
  userId: string,
  token: string,
): Promise<{ communityId: string }> {
  await requireProPlus(userId)

  const { data: invite, error } = await admin()
    .from('community_invites')
    .select('id, community_id, email, status, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (error || !invite) throw Object.assign(new Error('invalid_token'), { code: 'invalid_token' })
  if (invite.status !== 'pending') {
    throw Object.assign(new Error('invite_not_pending'), { code: 'invite_not_pending' })
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    throw Object.assign(new Error('invite_expired'), { code: 'invite_expired' })
  }

  const { data: profile } = await admin()
    .from('profiles')
    .select('email')
    .eq('user_id', userId)
    .maybeSingle()

  if (profile?.email?.toLowerCase() !== invite.email.toLowerCase()) {
    throw Object.assign(new Error('email_mismatch'), { code: 'email_mismatch' })
  }

  await admin()
    .from('community_invites')
    .update({ status: 'accepted' })
    .eq('id', invite.id)

  const { data: existing } = await admin()
    .from('community_members')
    .select('status')
    .eq('community_id', invite.community_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing?.status === 'active') {
    return { communityId: invite.community_id }
  }

  if (existing) {
    await admin()
      .from('community_members')
      .update({ status: 'active', role: 'member' })
      .eq('community_id', invite.community_id)
      .eq('user_id', userId)
  } else {
    await admin().from('community_members').insert({
      community_id: invite.community_id,
      user_id: userId,
      role: 'member',
      status: 'active',
    })
  }

  return { communityId: invite.community_id }
}

export async function listFolders(userId: string, communityId: string): Promise<CommunityFolder[]> {
  await assertMember(communityId, userId)

  const { data, error } = await admin()
    .from('community_folders')
    .select('id, community_id, parent_id, name, sort_order')
    .eq('community_id', communityId)
    .order('sort_order', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    communityId: row.community_id,
    parentId: row.parent_id,
    name: row.name,
    sortOrder: row.sort_order,
  }))
}

export async function createFolder(
  userId: string,
  communityId: string,
  name: string,
  parentId?: string | null,
): Promise<CommunityFolder> {
  await assertOwner(communityId, userId)
  const trimmed = name.trim()
  if (!trimmed) throw Object.assign(new Error('name_required'), { code: 'name_required' })

  const { data, error } = await admin()
    .from('community_folders')
    .insert({
      community_id: communityId,
      parent_id: parentId ?? null,
      name: trimmed,
      sort_order: Date.now() % 100000,
    })
    .select('id, community_id, parent_id, name, sort_order')
    .single()

  if (error || !data) throw error ?? new Error('create_failed')

  return {
    id: data.id,
    communityId: data.community_id,
    parentId: data.parent_id,
    name: data.name,
    sortOrder: data.sort_order,
  }
}

export async function updateFolder(
  userId: string,
  communityId: string,
  folderId: string,
  patch: { name?: string; parentId?: string | null },
): Promise<CommunityFolder> {
  await assertOwner(communityId, userId)

  const updates: Record<string, unknown> = {}
  if (typeof patch.name === 'string') updates.name = patch.name.trim()
  if (patch.parentId !== undefined) updates.parent_id = patch.parentId

  const { data, error } = await admin()
    .from('community_folders')
    .update(updates)
    .eq('id', folderId)
    .eq('community_id', communityId)
    .select('id, community_id, parent_id, name, sort_order')
    .single()

  if (error || !data) throw error ?? new Error('update_failed')

  return {
    id: data.id,
    communityId: data.community_id,
    parentId: data.parent_id,
    name: data.name,
    sortOrder: data.sort_order,
  }
}

export async function deleteFolder(
  userId: string,
  communityId: string,
  folderId: string,
): Promise<void> {
  await assertOwner(communityId, userId)

  const { error } = await admin()
    .from('community_folders')
    .delete()
    .eq('id', folderId)
    .eq('community_id', communityId)

  if (error) throw error
}

export async function listItems(
  userId: string,
  communityId: string,
  folderId?: string | null,
): Promise<CommunityItem[]> {
  await assertMember(communityId, userId)

  let query = admin()
    .from('community_items')
    .select('id, community_id, folder_id, type, title, content, source_session_id, shared_by, created_at')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })

  if (folderId) {
    query = query.eq('folder_id', folderId)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map(mapItem)
}

export async function getItem(
  userId: string,
  communityId: string,
  itemId: string,
): Promise<CommunityItem> {
  await assertMember(communityId, userId)

  const { data, error } = await admin()
    .from('community_items')
    .select('id, community_id, folder_id, type, title, content, source_session_id, shared_by, created_at')
    .eq('id', itemId)
    .eq('community_id', communityId)
    .single()

  if (error || !data) throw error ?? new Error('not_found')
  return mapItem(data)
}

export async function createItem(
  userId: string,
  communityId: string,
  payload: {
    folderId?: string | null
    type: CommunityItemType
    title: string
    content: unknown
    sourceSessionId?: string
  },
): Promise<CommunityItem> {
  await assertMember(communityId, userId)

  const title = payload.title.trim()
  if (!title) throw Object.assign(new Error('title_required'), { code: 'title_required' })

  const { data, error } = await admin()
    .from('community_items')
    .insert({
      community_id: communityId,
      folder_id: payload.folderId ?? null,
      type: payload.type,
      title,
      content: payload.content ?? {},
      source_session_id: payload.sourceSessionId ?? null,
      shared_by: userId,
    })
    .select('id, community_id, folder_id, type, title, content, source_session_id, shared_by, created_at')
    .single()

  if (error || !data) throw error ?? new Error('create_failed')
  return mapItem(data)
}

export async function deleteItem(
  userId: string,
  communityId: string,
  itemId: string,
): Promise<void> {
  const role = await assertMember(communityId, userId)

  const { data: item } = await admin()
    .from('community_items')
    .select('shared_by')
    .eq('id', itemId)
    .eq('community_id', communityId)
    .maybeSingle()

  if (!item) throw Object.assign(new Error('not_found'), { code: 'not_found' })
  if (role !== 'owner' && item.shared_by !== userId) {
    throw Object.assign(new Error('forbidden'), { code: 'forbidden' })
  }

  const { error } = await admin()
    .from('community_items')
    .delete()
    .eq('id', itemId)
    .eq('community_id', communityId)

  if (error) throw error
}

function mapItem(row: {
  id: string
  community_id: string
  folder_id: string | null
  type: string
  title: string
  content: unknown
  source_session_id: string | null
  shared_by: string
  created_at: string
}): CommunityItem {
  return {
    id: row.id,
    communityId: row.community_id,
    folderId: row.folder_id,
    type: row.type as CommunityItemType,
    title: row.title,
    content: row.content,
    sourceSessionId: row.source_session_id,
    sharedBy: row.shared_by,
    createdAt: row.created_at,
  }
}

export function communityErrorResponse(err: unknown): Response {
  const code = (err as { code?: string })?.code ?? 'server_error'
  const status =
    code === 'plan_required'
      ? 403
      : code === 'not_a_member' || code === 'owner_required' || code === 'forbidden'
        ? 403
        : code === 'not_found'
          ? 404
          : 400

  return Response.json({ error: code }, { status })
}
