import { resolveIntegrationUserId } from '@/lib/integration-auth'
import { requireFeature } from '@/lib/plan-guard'
import { communityErrorResponse, deleteItem, getItem } from '@/lib/communities'

type RouteContext = { params: Promise<{ id: string; itemId: string }> }

export async function GET(req: Request, context: RouteContext) {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const plan = await requireFeature(userId, 'communities')
  if (plan instanceof Response) return plan

  const { id, itemId } = await context.params

  try {
    const item = await getItem(userId, id, itemId)
    return Response.json({ item })
  } catch (err) {
    return communityErrorResponse(err)
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const plan = await requireFeature(userId, 'communities')
  if (plan instanceof Response) return plan

  const { id, itemId } = await context.params

  try {
    await deleteItem(userId, id, itemId)
    return Response.json({ ok: true })
  } catch (err) {
    return communityErrorResponse(err)
  }
}
