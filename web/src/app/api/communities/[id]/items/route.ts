import { resolveIntegrationUserId } from '@/lib/integration-auth'
import { requireFeature } from '@/lib/plan-guard'
import {
  communityErrorResponse,
  createItem,
  listItems,
  type CommunityItemType,
} from '@/lib/communities'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: Request, context: RouteContext) {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const plan = await requireFeature(userId, 'communities')
  if (plan instanceof Response) return plan

  const { id } = await context.params
  const url = new URL(req.url)
  const folderId = url.searchParams.get('folderId')

  try {
    const items = await listItems(userId, id, folderId)
    return Response.json({ items })
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

  const payload = body as {
    folderId?: string | null
    type?: CommunityItemType
    title?: string
    content?: unknown
    sourceSessionId?: string
  }

  if (!payload.type || !payload.title) {
    return Response.json({ error: 'invalid_payload' }, { status: 400 })
  }

  try {
    const item = await createItem(userId, id, {
      folderId: payload.folderId,
      type: payload.type,
      title: payload.title,
      content: payload.content,
      sourceSessionId: payload.sourceSessionId,
    })
    return Response.json({ item })
  } catch (err) {
    return communityErrorResponse(err)
  }
}
