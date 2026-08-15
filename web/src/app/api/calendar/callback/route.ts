import { redirect } from 'next/navigation'

import { consumeOAuthState, upsertCalendarConnection } from '@/lib/calendar/connections'
import { invalidateContactDirectoryCache } from '@/lib/calendar/contacts'
import { exchangeCalendarCode } from '@/lib/calendar/oauth'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    redirect(`/desktop/calendar/connect?error=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    redirect('/desktop/calendar/connect?error=missing_code')
  }

  const oauthState = await consumeOAuthState(state)
  if (!oauthState) {
    redirect('/desktop/calendar/connect?error=invalid_state')
  }

  const tokens = await exchangeCalendarCode(oauthState.provider, code, url.origin)
  if (!tokens || !tokens.refreshToken) {
    redirect(`/desktop/calendar/connect?provider=${oauthState.provider}&error=exchange_failed`)
  }

  const saved = await upsertCalendarConnection(oauthState.userId, oauthState.provider, tokens)
  if (!saved) {
    redirect(`/desktop/calendar/connect?provider=${oauthState.provider}&error=save_failed`)
  }

  invalidateContactDirectoryCache(oauthState.userId)
  redirect(`/desktop/calendar/success?provider=${oauthState.provider}`)
}
