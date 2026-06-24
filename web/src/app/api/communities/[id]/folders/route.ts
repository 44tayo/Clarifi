import { resolveIntegrationUserId } from '@/lib/integration-auth'
import { requireFeature } from '@/lib/plan-guard'
import { communityErrorResponse, createFolder, listFolders } from '@/lib/communities'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: Request, context: RouteContext) {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const plan = await requireFeature(userId, 'communities')
  if (plan instanceof Response) return plan

  const { id } = await context.params

  try {
    const folders = await listFolders(userId, id)
    return Response.json({ folders })
  } catch (err) {
    return communityErrorResponse(err)
  }
}

export async function POST(req: Request, context: RouteContext) {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const plan = await requireFeature(userId, 'communities')
  if (plan instanceof Response) return plan

  const { id } = await context.params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const payload = body as { name?: string; parentId?: string | null }
  if (typeof payload.name !== 'string') {
    return Response.json({ error: 'name_required' }, { status: 400 })
  }

  try {
    const folder = await createFolder(userId, id, payload.name, payload.parentId)
    return Response.json({ folder })
  } catch (err) {
    return communityErrorResponse(err)
  }
}
