import { getServerUserId } from '@/lib/auth-server'
import { requireFeature } from '@/lib/plan-guard'
import { acceptCommunityInvite, communityErrorResponse } from '@/lib/communities'

export async function POST(req: Request) {
  const userId = await getServerUserId()
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const plan = await requireFeature(userId, 'communities')
  if (plan instanceof Response) return plan

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const token = (body as { token?: string }).token
  if (typeof token !== 'string') {
    return Response.json({ error: 'token_required' }, { status: 400 })
  }

  try {
    const result = await acceptCommunityInvite(userId, token)
    return Response.json(result)
  } catch (err) {
    return communityErrorResponse(err)
  }
}
