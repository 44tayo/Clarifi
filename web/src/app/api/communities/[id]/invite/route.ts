import { resolveIntegrationUserId } from '@/lib/integration-auth'
import { requireFeature } from '@/lib/plan-guard'
import { communityErrorResponse, inviteToCommunity } from '@/lib/communities'
import { consumeRateLimit, rateLimitedResponse } from '@/lib/ip-rate-limit'

type RouteContext = { params: Promise<{ id: string }> }

const INVITE_LIMIT = 20
const INVITE_WINDOW_SECONDS = 60 * 60

export async function POST(req: Request, context: RouteContext) {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const plan = await requireFeature(userId, 'communities')
  if (plan instanceof Response) return plan

  const limit = await consumeRateLimit(`community_invite:user:${userId}`, INVITE_LIMIT, INVITE_WINDOW_SECONDS)
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds)

  const { id } = await context.params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const email = (body as { email?: string }).email
  if (typeof email !== 'string') {
    return Response.json({ error: 'email_required' }, { status: 400 })
  }

  try {
    const result = await inviteToCommunity(userId, id, email)
    return Response.json(result)
  } catch (err) {
    return communityErrorResponse(err)
  }
}
