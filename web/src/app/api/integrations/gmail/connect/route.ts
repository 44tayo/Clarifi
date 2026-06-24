import { getServerUserId } from '@/lib/auth-server'
import { buildGmailAuthorizeUrl, isGmailConfigured } from '@/lib/gmail'
import { isPlanGuardResponse, requireFeature } from '@/lib/plan-guard'
import { getSiteOrigin } from '@/lib/site-url'

export async function GET(req: Request) {
  if (!isGmailConfigured()) {
    return Response.json({ error: 'gmail_not_configured' }, { status: 503 })
  }

  const userId = await getServerUserId()
  if (!userId) {
    const url = new URL(req.url)
    const next = `${url.pathname}${url.search}`
    return Response.redirect(
      `${getSiteOrigin(url.origin)}/sign-in?next=${encodeURIComponent(next)}`,
      302,
    )
  }

  const planOrBlock = await requireFeature(userId, 'gmail')
  if (isPlanGuardResponse(planOrBlock)) {
    return Response.redirect(`${getSiteOrigin(new URL(req.url).origin)}/billing`, 302)
  }

  const authorizeUrl = buildGmailAuthorizeUrl(userId, new URL(req.url).origin)
  if (!authorizeUrl) {
    return Response.json({ error: 'gmail_not_configured' }, { status: 503 })
  }

  return Response.redirect(authorizeUrl, 302)
}
