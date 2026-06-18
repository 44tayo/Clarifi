import {
  exchangeGmailCode,
  fetchGmailProfileEmail,
  saveGmailConnection,
  verifyOAuthState,
} from '@/lib/gmail'
import { getSiteOrigin } from '@/lib/site-url'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const origin = url.origin
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state) {
    return Response.redirect(`${getSiteOrigin(origin)}/dashboard?gmail=error`, 302)
  }

  const userId = verifyOAuthState(state)
  if (!userId) {
    return Response.redirect(`${getSiteOrigin(origin)}/dashboard?gmail=error`, 302)
  }

  const tokens = await exchangeGmailCode(code, origin)
  if (!tokens) {
    return Response.redirect(`${getSiteOrigin(origin)}/dashboard?gmail=error`, 302)
  }

  const emailAddress = await fetchGmailProfileEmail(tokens.access_token)
  const saved = await saveGmailConnection(userId, tokens, emailAddress)
  if (!saved) {
    return Response.redirect(`${getSiteOrigin(origin)}/dashboard?gmail=error`, 302)
  }

  return Response.redirect(`${getSiteOrigin(origin)}/desktop/gmail-connected`, 302)
}
