import {
  exchangeHubSpotCode,
  saveHubSpotConnection,
  verifyOAuthState,
} from '@/lib/hubspot'
import { getSiteOrigin } from '@/lib/site-url'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const origin = url.origin

  if (!code || !state) {
    return Response.redirect(`${getSiteOrigin(origin)}/dashboard?hubspot=error`, 302)
  }

  const userId = verifyOAuthState(state)
  if (!userId) {
    return Response.redirect(`${getSiteOrigin(origin)}/dashboard?hubspot=error`, 302)
  }

  const tokens = await exchangeHubSpotCode(code, origin)
  if (!tokens) {
    return Response.redirect(`${getSiteOrigin(origin)}/dashboard?hubspot=error`, 302)
  }

  await saveHubSpotConnection(userId, tokens)
  return Response.redirect(`${getSiteOrigin(origin)}/dashboard?hubspot=connected`, 302)
}
