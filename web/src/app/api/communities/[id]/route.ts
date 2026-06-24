import { resolveIntegrationUserId } from '@/lib/integration-auth'
import { requireFeature } from '@/lib/plan-guard'
import { communityErrorResponse, getCommunityDetail } from '@/lib/communities'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: Request, context: RouteContext) {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const plan = await requireFeature(userId, 'communities')
  if (plan instanceof Response) return plan

  const { id } = await context.params

  try {
    const detail = await getCommunityDetail(userId, id)
    return Response.json(detail)
  } catch (err) {
    return communityErrorResponse(err)
  }
}
