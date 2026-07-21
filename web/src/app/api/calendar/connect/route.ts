import { redirect } from 'next/navigation'

import { createOAuthState } from '@/lib/calendar/connections'
import {
  buildCalendarAuthUrl,
  createOAuthStateToken,
  isCalendarOAuthConfigured,
  oauthStateExpiresAt,
} from '@/lib/calendar/oauth'
import { getServerUserId } from '@/lib/auth-server'
import type { CalendarProvider } from '@/lib/calendar/types'

function parseProvider(value: string | null): CalendarProvider | null {
  if (value === 'google' || value === 'microsoft') return value
  return null
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const provider = parseProvider(url.searchParams.get('provider'))
  if (!provider) {
    return Response.json({ error: 'invalid_provider' }, { status: 400 })
  }

  if (!isCalendarOAuthConfigured(provider)) {
    return Response.json({ error: 'calendar_oauth_not_configured' }, { status: 503 })
  }

  const userId = await getServerUserId()
  if (!userId) {
    const next = `/desktop/calendar/connect?provider=${provider}`
    redirect(`/sign-in?next=${encodeURIComponent(next)}`)
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

  redirect(authUrl)
}
