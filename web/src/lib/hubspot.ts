import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { getSiteOrigin } from '@/lib/site-url'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const HUBSPOT_AUTHORIZE_URL = 'https://app.hubspot.com/oauth/authorize'
const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token'
const HUBSPOT_API_BASE = 'https://api.hubapi.com'

const HUBSPOT_SCOPES = [
  'oauth',
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.deals.read',
  'crm.objects.deals.write',
].join(' ')

export type HubSpotConnection = {
  userId: string
  accessToken: string
  refreshToken: string
  expiresAt: string
  hubId: number | null
  autoSyncEnabled: boolean
  defaultContactEmail: string | null
  defaultDealId: string | null
}

export type HubSpotRecapPayload = {
  sessionId: string
  title?: string
  endedAt?: number
  summary?: string
  dealSummary?: string
  internalCrmNote?: string
  actionItems?: string[]
  mutualActionPlan?: string[]
  painPointsUncovered?: string[]
  objectionsRaised?: Array<{ type?: string; summary?: string; handled?: string }>
  openQuestions?: string[]
  decisions?: string[]
}

function hubspotClientId(): string | null {
  return process.env.HUBSPOT_CLIENT_ID?.trim() || null
}

function hubspotClientSecret(): string | null {
  return process.env.HUBSPOT_CLIENT_SECRET?.trim() || null
}

export function isHubSpotConfigured(): boolean {
  return Boolean(hubspotClientId() && hubspotClientSecret())
}

export function hubspotRedirectUri(origin?: string): string {
  return `${getSiteOrigin(origin)}/api/integrations/hubspot/callback`
}

function signOAuthState(userId: string): string {
  const secret = hubspotClientSecret() ?? 'dev'
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
    const secret = hubspotClientSecret() ?? 'dev'
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

export function buildHubSpotAuthorizeUrl(userId: string, origin?: string): string | null {
  const clientId = hubspotClientId()
  if (!clientId) return null

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: hubspotRedirectUri(origin),
    scope: HUBSPOT_SCOPES,
    state: signOAuthState(userId),
  })

  return `${HUBSPOT_AUTHORIZE_URL}?${params.toString()}`
}

type TokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  hub_id?: number
}

async function exchangeToken(body: URLSearchParams): Promise<TokenResponse | null> {
  const clientId = hubspotClientId()
  const clientSecret = hubspotClientSecret()
  if (!clientId || !clientSecret) return null

  const response = await fetch(HUBSPOT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    console.error('HubSpot token exchange failed:', await response.text())
    return null
  }

  return (await response.json()) as TokenResponse
}

export async function exchangeHubSpotCode(
  code: string,
  origin?: string,
): Promise<TokenResponse | null> {
  const clientId = hubspotClientId()
  const clientSecret = hubspotClientSecret()
  if (!clientId || !clientSecret) return null

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: hubspotRedirectUri(origin),
    code,
  })

  return exchangeToken(body)
}

async function refreshHubSpotAccessToken(
  connection: HubSpotConnection,
): Promise<HubSpotConnection | null> {
  const clientId = hubspotClientId()
  const clientSecret = hubspotClientSecret()
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
    .from('hubspot_connections')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      hub_id: tokens.hub_id ?? connection.hubId,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', connection.userId)

  if (error) {
    console.error('Failed to persist refreshed HubSpot token:', error.message)
    return null
  }

  return {
    ...connection,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
    hubId: tokens.hub_id ?? connection.hubId,
  }
}

function mapConnectionRow(row: Record<string, unknown>): HubSpotConnection {
  return {
    userId: String(row.user_id),
    accessToken: String(row.access_token),
    refreshToken: String(row.refresh_token),
    expiresAt: String(row.expires_at),
    hubId: typeof row.hub_id === 'number' ? row.hub_id : row.hub_id ? Number(row.hub_id) : null,
    autoSyncEnabled: row.auto_sync_enabled !== false,
    defaultContactEmail:
      typeof row.default_contact_email === 'string' ? row.default_contact_email : null,
    defaultDealId: typeof row.default_deal_id === 'string' ? row.default_deal_id : null,
  }
}

export async function getHubSpotConnection(userId: string): Promise<HubSpotConnection | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('hubspot_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null
  return mapConnectionRow(data as Record<string, unknown>)
}

export async function saveHubSpotConnection(
  userId: string,
  tokens: TokenResponse,
): Promise<HubSpotConnection | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  const row = {
    user_id: userId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    hub_id: tokens.hub_id ?? null,
    auto_sync_enabled: true,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('hubspot_connections')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error || !data) {
    console.error('saveHubSpotConnection failed:', error?.message)
    return null
  }

  return mapConnectionRow(data as Record<string, unknown>)
}

export async function updateHubSpotSettings(
  userId: string,
  input: {
    autoSyncEnabled?: boolean
    defaultContactEmail?: string | null
    defaultDealId?: string | null
  },
): Promise<HubSpotConnection | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof input.autoSyncEnabled === 'boolean') {
    patch.auto_sync_enabled = input.autoSyncEnabled
  }
  if (input.defaultContactEmail !== undefined) {
    patch.default_contact_email = input.defaultContactEmail?.trim() || null
  }
  if (input.defaultDealId !== undefined) {
    patch.default_deal_id = input.defaultDealId?.trim() || null
  }

  const { data, error } = await supabase
    .from('hubspot_connections')
    .update(patch)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle()

  if (error || !data) return null
  return mapConnectionRow(data as Record<string, unknown>)
}

export async function deleteHubSpotConnection(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return false

  const { error } = await supabase.from('hubspot_connections').delete().eq('user_id', userId)
  return !error
}

async function getValidAccessToken(connection: HubSpotConnection): Promise<string | null> {
  const expiresMs = new Date(connection.expiresAt).getTime()
  if (Date.now() < expiresMs - 60_000) return connection.accessToken

  const refreshed = await refreshHubSpotAccessToken(connection)
  return refreshed?.accessToken ?? null
}

async function hubspotFetch(
  connection: HubSpotConnection,
  path: string,
  init?: RequestInit,
): Promise<Response | null> {
  const token = await getValidAccessToken(connection)
  if (!token) return null

  return fetch(`${HUBSPOT_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}

export async function findHubSpotContactByEmail(
  connection: HubSpotConnection,
  email: string,
): Promise<string | null> {
  const response = await hubspotFetch(connection, '/crm/v3/objects/contacts/search', {
    method: 'POST',
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'email',
              operator: 'EQ',
              value: email.trim().toLowerCase(),
            },
          ],
        },
      ],
      properties: ['email', 'firstname', 'lastname'],
      limit: 1,
    }),
  })

  if (!response?.ok) return null
  const data = (await response.json()) as { results?: Array<{ id: string }> }
  return data.results?.[0]?.id ?? null
}

function buildNoteBody(recap: HubSpotRecapPayload): string {
  const lines: string[] = []
  const title = recap.title?.trim() || 'Clarifi call'
  const when = recap.endedAt ? new Date(recap.endedAt).toLocaleString() : new Date().toLocaleString()

  lines.push(`Call recap — ${title}`)
  lines.push(when)
  lines.push('')

  if (recap.internalCrmNote?.trim()) {
    lines.push('CRM note')
    lines.push(recap.internalCrmNote.trim())
    lines.push('')
  }

  if (recap.summary?.trim()) {
    lines.push('Summary')
    lines.push(recap.summary.trim())
    lines.push('')
  }

  if (recap.dealSummary?.trim()) {
    lines.push('Deal summary')
    lines.push(recap.dealSummary.trim())
    lines.push('')
  }

  if (recap.painPointsUncovered?.length) {
    lines.push('Pain points')
    for (const item of recap.painPointsUncovered) lines.push(`• ${item}`)
    lines.push('')
  }

  if (recap.objectionsRaised?.length) {
    lines.push('Objections')
    for (const item of recap.objectionsRaised) {
      lines.push(`• ${item.type ?? 'other'}: ${item.summary ?? ''}`)
    }
    lines.push('')
  }

  if (recap.decisions?.length) {
    lines.push('Decisions')
    for (const item of recap.decisions) lines.push(`• ${item}`)
    lines.push('')
  }

  if (recap.openQuestions?.length) {
    lines.push('Open questions')
    for (const item of recap.openQuestions) lines.push(`• ${item}`)
    lines.push('')
  }

  if (recap.actionItems?.length) {
    lines.push('Action items')
    for (const item of recap.actionItems) lines.push(`• ${item}`)
    lines.push('')
  }

  if (recap.mutualActionPlan?.length) {
    lines.push('Mutual action plan')
    for (const item of recap.mutualActionPlan) lines.push(`• ${item}`)
  }

  return lines.join('\n').trim()
}

function taskSubjects(recap: HubSpotRecapPayload): string[] {
  const items = [...(recap.actionItems ?? []), ...(recap.mutualActionPlan ?? [])]
  const unique = new Set<string>()
  for (const raw of items) {
    const trimmed = raw.trim()
    if (trimmed) unique.add(trimmed.slice(0, 200))
  }
  return [...unique]
}

async function createHubSpotNote(
  connection: HubSpotConnection,
  contactId: string,
  body: string,
  timestamp: number,
): Promise<string | null> {
  const response = await hubspotFetch(connection, '/crm/v3/objects/notes', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        hs_timestamp: String(timestamp),
        hs_note_body: body,
      },
      associations: [
        {
          to: { id: contactId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }],
        },
      ],
    }),
  })

  if (!response?.ok) {
    console.error('HubSpot note create failed:', await response?.text())
    return null
  }

  const data = (await response.json()) as { id?: string }
  return data.id ?? null
}

async function createHubSpotTask(
  connection: HubSpotConnection,
  contactId: string,
  subject: string,
  timestamp: number,
): Promise<string | null> {
  const response = await hubspotFetch(connection, '/crm/v3/objects/tasks', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        hs_timestamp: String(timestamp),
        hs_task_subject: subject.slice(0, 200),
        hs_task_body: subject,
        hs_task_status: 'NOT_STARTED',
        hs_task_priority: 'MEDIUM',
        hs_task_type: 'TODO',
      },
      associations: [
        {
          to: { id: contactId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 204 }],
        },
      ],
    }),
  })

  if (!response?.ok) {
    console.error('HubSpot task create failed:', await response?.text())
    return null
  }

  const data = (await response.json()) as { id?: string }
  return data.id ?? null
}

export type HubSpotSyncResult =
  | { ok: true; noteId: string | null; taskIds: string[]; contactId: string }
  | { ok: false; error: string }

export async function syncRecapToHubSpot(
  userId: string,
  recap: HubSpotRecapPayload,
): Promise<HubSpotSyncResult> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return { ok: false, error: 'storage_unavailable' }

  const { data: existing } = await supabase
    .from('hubspot_sync_log')
    .select('id')
    .eq('user_id', userId)
    .eq('session_id', recap.sessionId)
    .eq('status', 'success')
    .maybeSingle()

  if (existing) return { ok: false, error: 'already_synced' }

  const connection = await getHubSpotConnection(userId)
  if (!connection) return { ok: false, error: 'not_connected' }
  if (!connection.autoSyncEnabled) return { ok: false, error: 'auto_sync_disabled' }

  const email = connection.defaultContactEmail?.trim()
  if (!email) return { ok: false, error: 'contact_email_required' }

  const contactId = await findHubSpotContactByEmail(connection, email)
  if (!contactId) return { ok: false, error: 'contact_not_found' }

  const timestamp = recap.endedAt ?? Date.now()
  const noteBody = buildNoteBody(recap)
  const noteId = noteBody ? await createHubSpotNote(connection, contactId, noteBody, timestamp) : null

  const taskIds: string[] = []
  for (const subject of taskSubjects(recap)) {
    const taskId = await createHubSpotTask(connection, contactId, subject, timestamp)
    if (taskId) taskIds.push(taskId)
  }

  const status = noteId || taskIds.length > 0 ? 'success' : 'failed'
  const error = status === 'failed' ? 'hubspot_create_failed' : null

  await supabase.from('hubspot_sync_log').insert({
    user_id: userId,
    session_id: recap.sessionId,
    hubspot_note_id: noteId,
    hubspot_task_ids: taskIds,
    contact_id: contactId,
    deal_id: connection.defaultDealId,
    status,
    error,
  })

  if (status === 'failed') return { ok: false, error: 'hubspot_create_failed' }

  return { ok: true, noteId, taskIds, contactId }
}

export function toPublicHubSpotStatus(connection: HubSpotConnection | null) {
  if (!connection) {
    return {
      connected: false,
      configured: isHubSpotConfigured(),
      autoSyncEnabled: false,
      defaultContactEmail: null as string | null,
      defaultDealId: null as string | null,
      hubId: null as number | null,
    }
  }

  return {
    connected: true,
    configured: isHubSpotConfigured(),
    autoSyncEnabled: connection.autoSyncEnabled,
    defaultContactEmail: connection.defaultContactEmail,
    defaultDealId: connection.defaultDealId,
    hubId: connection.hubId,
  }
}
