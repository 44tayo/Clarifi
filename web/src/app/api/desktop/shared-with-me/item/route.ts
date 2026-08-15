import { resolveIntegrationUserId } from '@/lib/integration-auth'
import { getSharedWithMeItem } from '@/lib/shared-with-me'

export async function GET(req: Request) {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const communityId = url.searchParams.get('communityId')
  const itemId = url.searchParams.get('itemId')
  if (!communityId || !itemId) {
    return Response.json({ error: 'communityId_and_itemId_required' }, { status: 400 })
  }

  try {
    const item = await getSharedWithMeItem(userId, communityId, itemId)
    return Response.json({ item })
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'plan_required') {
      return Response.json({ error: 'plan_required' }, { status: 403 })
    }
    if (code === 'not_a_member') {
      return Response.json({ error: 'not_a_member' }, { status: 403 })
    }
    console.error('[desktop/shared-with-me/item]', err)
    return Response.json({ error: 'not_found' }, { status: 404 })
  }
}
