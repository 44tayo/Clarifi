import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { getSiteOrigin } from '@/lib/site-url'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1'

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

export type GmailConnection = {
  userId: string
  accessToken: string
  refreshToken: string
  expiresAt: string
  emailAddress: string | null
}

export type GmailMessageSummary = {
  id: string
  threadId: string
  subject: string
  from: string
  date: string
  snippet: string
  body: string
  webUrl: string
}

export function gmailMessageWebUrl(threadId: string): string {
  return `https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(threadId)}`
}

function gmailClientId(): string | null {
  return process.env.GOOGLE_GMAIL_CLIENT_ID?.trim() || null
}

function gmailClientSecret(): string | null {
  return process.env.GOOGLE_GMAIL_CLIENT_SECRET?.trim() || null
}

export function isGmailConfigured(): boolean {
  return Boolean(gmailClientId() && gmailClientSecret())
}

export function gmailRedirectUri(origin?: string): string {
  return `${getSiteOrigin(origin)}/api/integrations/gmail/callback`
}

function signOAuthState(userId: string): string {
  const secret = gmailClientSecret() ?? 'dev'
  const nonce = randomBytes(16).toString('hex')
  const payload = `${userId}:${nonce}`
  const sig = createHmac('sha256', secret).update(payload).digest('hex')
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

export function verifyOAuthState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8')
    const [userId, nonce, sig] = decoded.split(':')
    if (!userId || !nonce || !sig) return null
    const secret = gmailClientSecret() ?? 'dev'
    const payload = `${userId}:${nonce}`
    const expected = createHmac('sha256', secret).update(payload).digest('hex')
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    return userId
  } catch {
    return null
  }
}

export function buildGmailAuthorizeUrl(userId: string, origin?: string): string | null {
  const clientId = gmailClientId()
  if (!clientId) return null

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: gmailRedirectUri(origin),
    response_type: 'code',
    scope: GMAIL_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: signOAuthState(userId),
  })

  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
}

async function exchangeToken(body: URLSearchParams): Promise<TokenResponse | null> {
  const clientId = gmailClientId()
  const clientSecret = gmailClientSecret()
  if (!clientId || !clientSecret) return null

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    console.error('Gmail token exchange failed:', await response.text())
    return null
  }

  return (await response.json()) as TokenResponse
}

export async function exchangeGmailCode(
  code: string,
  origin?: string,
): Promise<(TokenResponse & { refresh_token: string }) | null> {
  const clientId = gmailClientId()
  const clientSecret = gmailClientSecret()
  if (!clientId || !clientSecret) return null

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: gmailRedirectUri(origin),
    code,
  })

  const tokens = await exchangeToken(body)
  if (!tokens?.refresh_token) return null
  return { ...tokens, refresh_token: tokens.refresh_token }
}

async function refreshGmailAccessToken(
  connection: GmailConnection,
): Promise<GmailConnection | null> {
  const clientId = gmailClientId()
  const clientSecret = gmailClientSecret()
  if (!clientId || !clientSecret) return null

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: connection.refreshToken,
  })

  const tokens = await exchangeToken(body)
  if (!tokens) return null

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  const { error } = await supabase
    .from('gmail_connections')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? connection.refreshToken,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', connection.userId)

  if (error) {
    console.error('Failed to persist refreshed Gmail token:', error.message)
    return null
  }

  return {
    ...connection,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? connection.refreshToken,
    expiresAt,
  }
}

function mapConnectionRow(row: Record<string, unknown>): GmailConnection {
  return {
    userId: String(row.user_id),
    accessToken: String(row.access_token),
    refreshToken: String(row.refresh_token),
    expiresAt: String(row.expires_at),
    emailAddress:
      typeof row.email_address === 'string' ? row.email_address : null,
  }
}

export async function getGmailConnection(userId: string): Promise<GmailConnection | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('gmail_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null

  let connection = mapConnectionRow(data as Record<string, unknown>)
  if (new Date(connection.expiresAt).getTime() <= Date.now() + 60_000) {
    const refreshed = await refreshGmailAccessToken(connection)
    if (refreshed) connection = refreshed
  }

  return connection
}

export async function saveGmailConnection(
  userId: string,
  tokens: TokenResponse & { refresh_token: string },
  emailAddress?: string | null,
): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return false

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  const { error } = await supabase.from('gmail_connections').upsert({
    user_id: userId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    email_address: emailAddress ?? null,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    console.error('Failed to save Gmail connection:', error.message)
    return false
  }

  return true
}

export async function disconnectGmail(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return false
  const { error } = await supabase.from('gmail_connections').delete().eq('user_id', userId)
  return !error
}

export type PublicGmailStatus = {
  connected: boolean
  configured: boolean
  emailAddress: string | null
}

export function toPublicGmailStatus(connection: GmailConnection | null): PublicGmailStatus {
  return {
    connected: Boolean(connection),
    configured: isGmailConfigured(),
    emailAddress: connection?.emailAddress ?? null,
  }
}

async function gmailFetch(
  connection: GmailConnection,
  path: string,
): Promise<Response> {
  return fetch(`${GMAIL_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${connection.accessToken}` },
  })
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(normalized, 'base64').toString('utf8')
}

function extractBody(payload: {
  body?: { data?: string }
  parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }>
}): string {
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }

  const parts = payload.parts ?? []
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64Url(part.body.data)
    }
  }
  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      return decodeBase64Url(part.body.data).replace(/<[^>]+>/g, ' ')
    }
  }

  return ''
}

function headerValue(
  headers: Array<{ name?: string; value?: string }> | undefined,
  name: string,
): string {
  const match = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())
  return match?.value?.trim() ?? ''
}

export async function fetchGmailProfileEmail(
  accessToken: string,
): Promise<string | null> {
  const response = await fetch(`${GMAIL_API_BASE}/users/me/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) return null
  const data = (await response.json()) as { emailAddress?: string }
  return data.emailAddress?.trim() || null
}

export async function searchGmailMessages(
  userId: string,
  query: string,
  maxResults = 5,
): Promise<GmailMessageSummary[]> {
  const connection = await getGmailConnection(userId)
  if (!connection) return []

  const listRes = await gmailFetch(
    connection,
    `/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
  )
  if (!listRes.ok) return []

  const listData = (await listRes.json()) as { messages?: Array<{ id: string }> }
  const ids = listData.messages?.map((m) => m.id).filter(Boolean) ?? []
  const results: GmailMessageSummary[] = []

  for (const id of ids) {
    const msgRes = await gmailFetch(
      connection,
      `/users/me/messages/${encodeURIComponent(id)}?format=full`,
    )
    if (!msgRes.ok) continue
    const msg = (await msgRes.json()) as {
      id: string
      threadId: string
      snippet?: string
      payload?: {
        headers?: Array<{ name?: string; value?: string }>
        body?: { data?: string }
        parts?: Array<{ mimeType?: string; body?: { data?: string } }>
      }
    }

    const body = extractBody(msg.payload ?? {}).replace(/\s+/g, ' ').trim().slice(0, 4000)
    results.push({
      id: msg.id,
      threadId: msg.threadId,
      subject: headerValue(msg.payload?.headers, 'Subject') || '(no subject)',
      from: headerValue(msg.payload?.headers, 'From'),
      date: headerValue(msg.payload?.headers, 'Date'),
      snippet: msg.snippet?.trim() ?? '',
      body: body || msg.snippet?.trim() || '',
      webUrl: gmailMessageWebUrl(msg.threadId),
    })
  }

  return results
}

export function buildGmailContextText(messages: GmailMessageSummary[]): string {
  if (messages.length === 0) {
    return 'No matching emails found in the connected Gmail account.'
  }

  return messages
    .map(
      (msg, index) =>
        `Email ${index + 1}:\nFrom: ${msg.from}\nDate: ${msg.date}\nSubject: ${msg.subject}\nSnippet: ${msg.snippet}\nBody:\n${msg.body}`,
    )
    .join('\n\n---\n\n')
    .slice(0, 12_000)
}

export function messageRequestsGmailContext(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  return /\b(email|emails|gmail|inbox|mail|mailbox|message|messages|thread|threads|sent|reply|replied|unread|inbox|outbox|follow[\s-]?up email|find.*email|search.*email|last email|recent email|any email|my email)\b/i.test(
    text,
  )
}

export function extractGmailSearchQuery(message: string): string | null {
  const text = message.trim()
  if (!text) return null

  let cleaned = text
    .replace(
      /^(find|search|look up|lookup|show|get|pull up|summarize|summarise|summary of|read|check|open|locate)\s+(me\s+)?(my\s+)?(the\s+)?/i,
      '',
    )
    .replace(/\b(in gmail|in my inbox|from gmail|on gmail|in email|in my email)\b/gi, '')
    .replace(/\?$/, '')
    .trim()

  const lastFromMatch = cleaned.match(/\blast\s+email\s+from\s+([^?.!\n]+)/i)
  if (lastFromMatch?.[1]) return `from:${lastFromMatch[1].trim()}`

  const fromMatch = cleaned.match(/\b(?:from|by|sender)\s+([^?.!\n]+)/i)
  if (fromMatch?.[1]) return `from:${fromMatch[1].trim()}`

  const toMatch = cleaned.match(/\b(?:to|sent to)\s+([^?.!\n]+)/i)
  if (toMatch?.[1]) return `to:${toMatch[1].trim()}`

  const subjectMatch = cleaned.match(/\bsubject\s+["']?([^"'\n?.!]+)["']?/i)
  if (subjectMatch?.[1]) return `subject:${subjectMatch[1].trim()}`

  const aboutMatch = cleaned.match(/\b(?:about|regarding|re:)\s+([^?.!\n]+)/i)
  if (aboutMatch?.[1]) return aboutMatch[1].trim()

  if (/\bunread\b/i.test(cleaned)) return 'is:unread'

  if (messageRequestsGmailContext(text)) {
    cleaned = cleaned
      .replace(/\b(email|emails|gmail|inbox|mail|message|thread)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
    return cleaned.slice(0, 150) || text.slice(0, 150)
  }

  return null
}
