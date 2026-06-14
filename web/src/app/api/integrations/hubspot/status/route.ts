import { getHubSpotConnection, isHubSpotConfigured, toPublicHubSpotStatus } from '@/lib/hubspot'
import { resolveIntegrationUserId } from '@/lib/integration-auth'

export async function GET(req: Request) {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const connection = await getHubSpotConnection(userId)
  return Response.json(toPublicHubSpotStatus(connection))
}
