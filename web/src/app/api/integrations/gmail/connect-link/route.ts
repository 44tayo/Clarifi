import { buildGmailAuthorizeUrl, isGmailConfigured } from '@/lib/gmail'
import { resolveIntegrationUserId } from '@/lib/integration-auth'

export async function POST(req: Request) {
  if (!isGmailConfigured()) {
    return Response.json({ error: 'gmail_not_configured' }, { status: 503 })
  }

  const userId = await resolveIntegrationUserId(req)
  if (!userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const authorizeUrl = buildGmailAuthorizeUrl(userId, new URL(req.url).origin)
  if (!authorizeUrl) {
    return Response.json({ error: 'gmail_not_configured' }, { status: 503 })
  }

  return Response.json({ url: authorizeUrl })
}
