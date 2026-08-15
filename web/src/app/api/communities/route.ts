import { resolveIntegrationUserId } from '@/lib/integration-auth'
import { requireFeature, planRequiredResponse } from '@/lib/plan-guard'
import {
  communityErrorResponse,
  createCommunity,
  listCommunitiesForUser,
  listPendingInvitesForUser,
} from '@/lib/communities'

export async function GET(req: Request) {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const plan = await requireFeature(userId, 'communities')
  if (plan instanceof Response) return plan

  try {
    const [communities, invites] = await Promise.all([
      listCommunitiesForUser(userId),
      listPendingInvitesForUser(userId),
    ])
    return Response.json({ communities, invites })
  } catch (err) {
    return communityErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const plan = await requireFeature(userId, 'communities')
  if (plan instanceof Response) return plan

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const name = (body as { name?: string }).name
  if (typeof name !== 'string') {
    return Response.json({ error: 'name_required' }, { status: 400 })
  }

  try {
    const community = await createCommunity(userId, name)
    return Response.json({ community })
  } catch (err) {
    if ((err as { code?: string }).code === 'plan_required') {
      return planRequiredResponse('pro_plus', 'communities')
    }
    return communityErrorResponse(err)
  }
}
