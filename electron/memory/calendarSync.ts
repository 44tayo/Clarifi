import { shell } from 'electron'
import fetch from 'node-fetch'
import * as http from 'http'
import { loadRuntimeEnv } from '../keys'
import { CALENDAR_OAUTH_PORT, CALENDAR_SCOPES } from './constants'
import { openMemoryDatabase } from './db'

export type CalendarEvent = {
  id: string
  title: string
  start: string
  end: string
  attendees: string[]
  location: string | null
  description: string | null
}

export type CalendarConnectionStatus = {
  connected: boolean
  configured: boolean
  email: string | null
}

function calendarClientId(): string | null {
  loadRuntimeEnv()
  return (
    process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() ||
    process.env.GOOGLE_GMAIL_CLIENT_ID?.trim() ||
    null
  )
}

function calendarClientSecret(): string | null {
  loadRuntimeEnv()
  return (
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() ||
    process.env.GOOGLE_GMAIL_CLIENT_SECRET?.trim() ||
    null
  )
}

function redirectUri(): string {
  return `http://127.0.0.1:${CALENDAR_OAUTH_PORT}/callback`
}

function getStoredTokens(): {
  accessToken: string
  refreshToken: string | null
  expiresAt: number | null
} | null {
  const row = openMemoryDatabase()
    .prepare('SELECT access_token, refresh_token, expires_at FROM calendar_tokens WHERE id = 1')
    .get() as Record<string, unknown> | undefined
  if (!row?.access_token) return null
  return {
    accessToken: String(row.access_token),
    refreshToken: row.refresh_token == null ? null : String(row.refresh_token),
    expiresAt: row.expires_at == null ? null : Number(row.expires_at),
  }
}

function saveTokens(tokens: {
  accessToken: string
  refreshToken?: string | null
  expiresAt?: number | null
  scope?: string | null
}): void {
  const existing = getStoredTokens()
  openMemoryDatabase()
    .prepare(
      `INSERT INTO calendar_tokens (id, provider, access_token, refresh_token, expires_at, scope, updated_at)
       VALUES (1, 'google', ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = COALESCE(excluded.refresh_token, calendar_tokens.refresh_token),
         expires_at = excluded.expires_at,
         scope = excluded.scope,
         updated_at = excluded.updated_at`,
    )
    .run(
      tokens.accessToken,
      tokens.refreshToken ?? existing?.refreshToken ?? null,
      tokens.expiresAt ?? null,
      tokens.scope ?? CALENDAR_SCOPES.join(' '),
      Date.now(),
    )
}

function clearTokens(): void {
  openMemoryDatabase().prepare('DELETE FROM calendar_tokens WHERE id = 1').run()
}

export function getCalendarStatus(): CalendarConnectionStatus {
  const configured = Boolean(calendarClientId() && calendarClientSecret())
  const tokens = getStoredTokens()
  return {
    connected: Boolean(tokens?.accessToken),
    configured,
    email: null,
  }
}

async function exchangeCode(code: string): Promise<boolean> {
  const clientId = calendarClientId()
  const clientSecret = calendarClientSecret()
  if (!clientId || !clientSecret) return false

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    console.error('[calendar] token exchange failed:', await response.text())
    return false
  }

  const data = (await response.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    scope?: string
  }
  if (!data.access_token) return false

  saveTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
    scope: data.scope ?? null,
  })
  return true
}

async function refreshAccessToken(): Promise<string | null> {
  const tokens = getStoredTokens()
  const clientId = calendarClientId()
  const clientSecret = calendarClientSecret()
  if (!tokens?.refreshToken || !clientId || !clientSecret) return tokens?.accessToken ?? null

  if (tokens.expiresAt && tokens.expiresAt > Date.now() + 60_000) {
    return tokens.accessToken
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: tokens.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    console.error('[calendar] refresh failed:', await response.text())
    return null
  }

  const data = (await response.json()) as { access_token?: string; expires_in?: number }
  if (!data.access_token) return null

  saveTokens({
    accessToken: data.access_token,
    refreshToken: tokens.refreshToken,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
  })
  return data.access_token
}

export async function connectGoogleCalendar(): Promise<{ ok: boolean; error?: string }> {
  const clientId = calendarClientId()
  if (!clientId || !calendarClientSecret()) {
    return { ok: false, error: 'calendar_not_configured' }
  }

  return new Promise((resolve) => {
    let settled = false
    const finish = (result: { ok: boolean; error?: string }) => {
      if (settled) return
      settled = true
      server.close()
      resolve(result)
    }

    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', `http://127.0.0.1:${CALENDAR_OAUTH_PORT}`)
        if (url.pathname !== '/callback') {
          res.writeHead(404)
          res.end('Not found')
          return
        }

        const error = url.searchParams.get('error')
        if (error) {
          res.writeHead(400)
          res.end('Authorization denied')
          finish({ ok: false, error })
          return
        }

        const code = url.searchParams.get('code')
        if (!code) {
          res.writeHead(400)
          res.end('Missing code')
          finish({ ok: false, error: 'missing_code' })
          return
        }

        const ok = await exchangeCode(code)
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(
          ok
            ? '<html><body><h2>Google Calendar connected</h2><p>You can close this window and return to Clarifi.</p></body></html>'
            : '<html><body><h2>Connection failed</h2><p>Return to Clarifi and try again.</p></body></html>',
        )
        finish({ ok, error: ok ? undefined : 'exchange_failed' })
      } catch (err) {
        console.error('[calendar] callback error:', err)
        res.writeHead(500)
        res.end('Server error')
        finish({ ok: false, error: 'server_error' })
      }
    })

    server.listen(CALENDAR_OAUTH_PORT, '127.0.0.1', () => {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri(),
        response_type: 'code',
        scope: CALENDAR_SCOPES.join(' '),
        access_type: 'offline',
        prompt: 'consent',
      })
      void shell.openExternal(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
    })

    setTimeout(() => finish({ ok: false, error: 'timeout' }), 120_000)
  })
}

export function disconnectGoogleCalendar(): void {
  clearTokens()
}

export async function fetchTodayCalendarEvents(): Promise<CalendarEvent[]> {
  const accessToken = await refreshAccessToken()
  if (!accessToken) return []

  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '20',
  })

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  if (!response.ok) {
    console.error('[calendar] events fetch failed:', await response.text())
    return []
  }

  const data = (await response.json()) as {
    items?: Array<{
      id?: string
      summary?: string
      start?: { dateTime?: string; date?: string }
      end?: { dateTime?: string; date?: string }
      location?: string
      description?: string
      attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string }>
    }>
  }

  return (data.items ?? []).map((item) => ({
    id: item.id ?? '',
    title: item.summary ?? 'Untitled',
    start: item.start?.dateTime ?? item.start?.date ?? '',
    end: item.end?.dateTime ?? item.end?.date ?? '',
    location: item.location ?? null,
    description: item.description ?? null,
    attendees: (item.attendees ?? [])
      .map((a) => a.displayName?.trim() || a.email?.trim() || '')
      .filter(Boolean),
  }))
}
