import { buildGmailAuthorizeUrl, isGmailConfigured } from '@/lib/gmail'
import { requireIntegrationAccess } from '@/lib/integration-guard'

export async function POST(req: Request) {
  if (!isGmailConfigured()) {
    return Response.json({ error: 'gmail_not_configured' }, { status: 503 })
  }

  const access = await requireIntegrationAccess(req, 'gmail')
  if (access instanceof Response) return access

  const authorizeUrl = buildGmailAuthorizeUrl(access.userId, new URL(req.url).origin)
  if (!authorizeUrl) {
    return Response.json({ error: 'gmail_not_configured' }, { status: 503 })
  }

  return Response.json({ url: authorizeUrl })
}
