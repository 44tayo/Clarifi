import { resolveIntegrationUserId } from '@/lib/integration-auth'
import { listSharedWithMe } from '@/lib/shared-with-me'

export async function GET(req: Request) {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const result = await listSharedWithMe(userId)
    return Response.json(result)
  } catch (err) {
    console.error('[desktop/shared-with-me]', err)
    return Response.json({ error: 'list_failed' }, { status: 500 })
  }
}
