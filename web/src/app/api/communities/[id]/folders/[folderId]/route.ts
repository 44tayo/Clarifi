import { resolveIntegrationUserId } from '@/lib/integration-auth'
import { requireFeature } from '@/lib/plan-guard'
import {
  communityErrorResponse,
  deleteFolder,
  updateFolder,
} from '@/lib/communities'

type RouteContext = { params: Promise<{ id: string; folderId: string }> }

export async function PATCH(req: Request, context: RouteContext) {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const plan = await requireFeature(userId, 'communities')
  if (plan instanceof Response) return plan

  const { id, folderId } = await context.params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const payload = body as { name?: string; parentId?: string | null }

  try {
    const folder = await updateFolder(userId, id, folderId, payload)
    return Response.json({ folder })
  } catch (err) {
    return communityErrorResponse(err)
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const plan = await requireFeature(userId, 'communities')
  if (plan instanceof Response) return plan

  const { id, folderId } = await context.params

  try {
    await deleteFolder(userId, id, folderId)
    return Response.json({ ok: true })
  } catch (err) {
    return communityErrorResponse(err)
  }
}
