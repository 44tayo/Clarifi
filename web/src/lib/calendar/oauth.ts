import { randomBytes } from 'crypto'

import { getSiteOrigin } from '@/lib/site-url'
import type { CalendarProvider } from './types'

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000

export function createOAuthStateToken(): string {
  return randomBytes(24).toString('base64url')
}

export function oauthStateExpiresAt(): Date {
  return new Date(Date.now() + OAUTH_STATE_TTL_MS)
}

function googleClientId(): string | null {
  return (
    process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() ||
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    null
  )
}

function googleClientSecret(): string | null {
  return (
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ||
    null
  )
}

function microsoftClientId(): string | null {
  return (
    process.env.MICROSOFT_CALENDAR_CLIENT_ID?.trim() ||
    process.env.MICROSOFT_OAUTH_CLIENT_ID?.trim() ||
    process.env.AZURE_OAUTH_CLIENT_ID?.trim() ||
    null
  )
}

function microsoftClientSecret(): string | null {
  return (
    process.env.MICROSOFT_CALENDAR_CLIENT_SECRET?.trim() ||
    process.env.MICROSOFT_OAUTH_CLIENT_SECRET?.trim() ||
    process.env.AZURE_OAUTH_CLIENT_SECRET?.trim() ||
    null
  )
}

export function isCalendarOAuthConfigured(provider: CalendarProvider): boolean {
  if (provider === 'google') {
    return Boolean(googleClientId() && googleClientSecret())
  }
  return Boolean(microsoftClientId() && microsoftClientSecret())
}

export function calendarCallbackUrl(origin?: string): string {
  return `${getSiteOrigin(origin)}/api/calendar/callback`
}

export function buildCalendarAuthUrl(
  provider: CalendarProvider,
  state: string,
  origin?: string,
): string | null {
  const redirectUri = calendarCallbackUrl(origin)

  if (provider === 'google') {
    const clientId = googleClientId()
    if (!clientId) return null

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/contacts.readonly',
        'https://www.googleapis.com/auth/contacts.other.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  }

  const clientId = microsoftClientId()
  if (!clientId) return null

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: ['Calendars.Read', 'Contacts.Read', 'People.Read', 'User.Read', 'offline_access'].join(
      ' ',
    ),
    state,
    response_mode: 'query',
  })
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
}

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  error?: string
}

export async function exchangeCalendarCode(
  provider: CalendarProvider,
  code: string,
  origin?: string,
): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: Date
  accountEmail: string | null
} | null> {
  const redirectUri = calendarCallbackUrl(origin)

  if (provider === 'google') {
    const clientId = googleClientId()
    const clientSecret = googleClientSecret()
    if (!clientId || !clientSecret) return null

    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    })

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    const data = (await response.json()) as TokenResponse
    if (!response.ok || !data.access_token || !data.refresh_token) {
      console.error('Google calendar token exchange failed:', data.error ?? response.status)
      return null
    }

    const email = await fetchGoogleAccountEmail(data.access_token)
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      accountEmail: email,
    }
  }

  const clientId = microsoftClientId()
  const clientSecret = microsoftClientSecret()
  if (!clientId || !clientSecret) return null

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const data = (await response.json()) as TokenResponse & { refresh_token?: string }
  if (!response.ok || !data.access_token) {
    console.error('Microsoft calendar token exchange failed:', data.error ?? response.status)
    return null
  }

  const email = await fetchMicrosoftAccountEmail(data.access_token)
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? '',
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    accountEmail: email,
  }
}

export async function refreshCalendarAccessToken(
  provider: CalendarProvider,
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: Date; refreshToken?: string } | null> {
  if (provider === 'google') {
    const clientId = googleClientId()
    const clientSecret = googleClientSecret()
    if (!clientId || !clientSecret) return null

    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    })

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    const data = (await response.json()) as TokenResponse
    if (!response.ok || !data.access_token) return null

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      refreshToken: data.refresh_token,
    }
  }

  const clientId = microsoftClientId()
  const clientSecret = microsoftClientSecret()
  if (!clientId || !clientSecret) return null

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    scope: ['Calendars.Read', 'Contacts.Read', 'People.Read', 'User.Read', 'offline_access'].join(
      ' ',
    ),
  })

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const data = (await response.json()) as TokenResponse
  if (!response.ok || !data.access_token) return null

  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    refreshToken: data.refresh_token,
  }
}

async function fetchGoogleAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return null
    const data = (await response.json()) as { email?: string }
    return data.email ?? null
  } catch {
    return null
  }
}

async function fetchMicrosoftAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return null
    const data = (await response.json()) as { mail?: string; userPrincipalName?: string }
    return data.mail ?? data.userPrincipalName ?? null
  } catch {
    return null
  }
}
