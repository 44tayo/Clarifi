import { getHubSpotConnection, isHubSpotConfigured, toPublicHubSpotStatus } from '@/lib/hubspot'
import { requireIntegrationAccess } from '@/lib/integration-guard'

export async function GET(req: Request) {
  const access = await requireIntegrationAccess(req, 'hubspot')
  if (access instanceof Response) return access

  const connection = await getHubSpotConnection(access.userId)
  return Response.json(toPublicHubSpotStatus(connection))
}
