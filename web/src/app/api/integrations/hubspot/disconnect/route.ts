import { deleteHubSpotConnection } from '@/lib/hubspot'
import { requireIntegrationAccess } from '@/lib/integration-guard'

export async function POST(req: Request) {
  const access = await requireIntegrationAccess(req, 'hubspot')
  if (access instanceof Response) return access

  const ok = await deleteHubSpotConnection(access.userId)
  if (!ok) {
    return Response.json({ error: 'disconnect_failed' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
