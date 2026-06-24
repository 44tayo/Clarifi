import { getHubSpotConnection, toPublicHubSpotStatus, updateHubSpotSettings } from '@/lib/hubspot'
import { requireIntegrationAccess } from '@/lib/integration-guard'

export async function PATCH(req: Request) {
  const access = await requireIntegrationAccess(req, 'hubspot')
  if (access instanceof Response) return access

  const connection = await getHubSpotConnection(access.userId)
  if (!connection) {
    return Response.json({ error: 'not_connected' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const payload = body as {
    autoSyncEnabled?: boolean
    defaultContactEmail?: string | null
    defaultDealId?: string | null
  }

  const updated = await updateHubSpotSettings(access.userId, {
    autoSyncEnabled: payload.autoSyncEnabled,
    defaultContactEmail: payload.defaultContactEmail,
    defaultDealId: payload.defaultDealId,
  })

  if (!updated) {
    return Response.json({ error: 'update_failed' }, { status: 500 })
  }

  return Response.json(toPublicHubSpotStatus(updated))
}
