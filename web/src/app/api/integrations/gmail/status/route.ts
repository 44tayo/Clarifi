import { getGmailConnection, isGmailConfigured, toPublicGmailStatus } from '@/lib/gmail'
import { resolveIntegrationUserId } from '@/lib/integration-auth'

export async function GET(req: Request) {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const connection = await getGmailConnection(userId)
  return Response.json(toPublicGmailStatus(connection))
}
