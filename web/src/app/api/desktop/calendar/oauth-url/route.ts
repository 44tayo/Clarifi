import { createOAuthState } from '@/lib/calendar/connections'
import {
  buildCalendarAuthUrl,
  createOAuthStateToken,
  isCalendarOAuthConfigured,
  oauthStateExpiresAt,
} from '@/lib/calendar/oauth'
import type { CalendarProvider } from '@/lib/calendar/types'
import { getUserIdFromDeviceRequest } from '@/lib/device-auth'

function parseProvider(value: string | null): CalendarProvider | null {
  if (value === 'google' || value === 'microsoft') return value
  return null
}

/**
 * Mint a Google/Microsoft OAuth URL bound to the *paired desktop account*,
 * not whatever browser session happens to be open. Tokens land in
 * calendar_connections for that user and survive forever across sessions.
 */
export async function GET(req: Request) {
  const userId = await getUserIdFromDeviceRequest(req)
  if (!userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const provider = parseProvider(url.searchParams.get('provider'))
  if (!provider) {
    return Response.json({ error: 'invalid_provider' }, { status: 400 })
  }

  if (!isCalendarOAuthConfigured(provider)) {
    return Response.json({ error: 'calendar_oauth_not_configured' }, { status: 503 })
  }

  const state = createOAuthStateToken()
  const saved = await createOAuthState(userId, provider, state, oauthStateExpiresAt())
  if (!saved) {
    return Response.json({ error: 'state_create_failed' }, { status: 500 })
  }

  const authUrl = buildCalendarAuthUrl(provider, state, url.origin)
  if (!authUrl) {
    return Response.json({ error: 'calendar_oauth_not_configured' }, { status: 503 })
  }

  return Response.json({ ok: true, provider, authUrl })
}
