import { getGmailConnection, toPublicGmailStatus } from '@/lib/gmail'
import { requireIntegrationAccess } from '@/lib/integration-guard'

export async function GET(req: Request) {
  const access = await requireIntegrationAccess(req, 'gmail')
  if (access instanceof Response) return access

  const connection = await getGmailConnection(access.userId)
  return Response.json(toPublicGmailStatus(connection))
}
