import { deleteHubSpotConnection } from '@/lib/hubspot'
import { resolveIntegrationUserId } from '@/lib/integration-auth'

export async function POST(req: Request) {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const ok = await deleteHubSpotConnection(userId)
  if (!ok) {
    return Response.json({ error: 'disconnect_failed' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
