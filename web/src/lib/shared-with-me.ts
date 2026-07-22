import {
  acceptCommunityInvite,
  getItem,
  listCommunitiesForUser,
  listItems,
  listPendingInvitesForUser,
  type CommunityItem,
} from '@/lib/communities'
import { getUserPlan } from '@/lib/usage'
import { hasFeature } from '@/lib/entitlements'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

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

function previewFromContent(content: unknown): string | null {
  if (!content || typeof content !== 'object') return null
  const c = content as Record<string, unknown>
  const summary = typeof c.summary === 'string' ? c.summary.trim() : ''
  if (summary) return summary.slice(0, 160)
  const notes = typeof c.enhancedNotes === 'string' ? c.enhancedNotes.trim() : ''
  if (notes) return notes.replace(/^#+\s*/gm, '').slice(0, 160)
  const userNotes = typeof c.userNotes === 'string' ? c.userNotes.trim() : ''
  if (userNotes) return userNotes.slice(0, 160)
  return null
}

async function sharedByLabel(userId: string): Promise<string> {
  const admin = getSupabaseAdmin()
  if (!admin) return 'Someone'
  const { data } = await admin.from('profiles').select('email').eq('user_id', userId).maybeSingle()
  const email = data?.email?.trim()
  if (!email) return 'Someone'
  return email.split('@')[0] || email
}

export async function listSharedWithMe(userId: string): Promise<{
  entries: SharedInboxEntry[]
  planRequired: boolean
}> {
  const plan = await getUserPlan(userId)
  if (!hasFeature(plan, 'communities')) {
    return { entries: [], planRequired: true }
  }

  const [invites, communities] = await Promise.all([
    listPendingInvitesForUser(userId),
    listCommunitiesForUser(userId),
  ])

  const inviteEntries: SharedInboxInvite[] = invites.map((invite) => ({
    kind: 'invite',
    id: invite.id,
    communityId: invite.communityId,
    communityName: invite.communityName,
    token: invite.token,
    expiresAt: invite.expiresAt,
  }))

  const itemBatches = await Promise.all(
    communities.map(async (community) => {
      const items = await listItems(userId, community.id)
      const inbound = items.filter((item) => item.sharedBy !== userId)
      return Promise.all(
        inbound.map(async (item): Promise<SharedInboxItem> => ({
          kind: 'item',
          id: item.id,
          communityId: item.communityId,
          communityName: community.name,
          title: item.title,
          type: item.type,
          sharedBy: item.sharedBy,
          sharedByLabel: await sharedByLabel(item.sharedBy),
          createdAt: item.createdAt,
          preview: previewFromContent(item.content),
        })),
      )
    }),
  )

  const itemEntries = itemBatches.flat()
  itemEntries.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

  return {
    entries: [...inviteEntries, ...itemEntries],
    planRequired: false,
  }
}

export async function getSharedWithMeItem(
  userId: string,
  communityId: string,
  itemId: string,
): Promise<CommunityItem & { sharedByLabel: string; communityName: string }> {
  const plan = await getUserPlan(userId)
  if (!hasFeature(plan, 'communities')) {
    throw Object.assign(new Error('plan_required'), { code: 'plan_required' })
  }

  const item = await getItem(userId, communityId, itemId)
  const communities = await listCommunitiesForUser(userId)
  const community = communities.find((c) => c.id === communityId)

  return {
    ...item,
    sharedByLabel: await sharedByLabel(item.sharedBy),
    communityName: community?.name ?? 'Shared',
  }
}

export async function acceptSharedInvite(
  userId: string,
  token: string,
): Promise<{ communityId: string }> {
  return acceptCommunityInvite(userId, token)
}
