import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { CalendarProvider } from './types'

type StoredConnection = {
  user_id: string
  provider: CalendarProvider
  access_token: string
  refresh_token: string
  expires_at: string
  account_email: string | null
}

export async function getCalendarConnection(
  userId: string,
  provider: CalendarProvider,
): Promise<StoredConnection | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle()

  if (error || !data) return null
  return data as StoredConnection
}

export async function listCalendarConnections(userId: string): Promise<StoredConnection[]> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)

  if (error || !data) return []
  return data as StoredConnection[]
}

export async function upsertCalendarConnection(
  userId: string,
  provider: CalendarProvider,
  tokens: {
    accessToken: string
    refreshToken: string
    expiresAt: Date
    accountEmail?: string | null
  },
): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return false

  // Preserve an existing refresh token if the provider omitted a new one.
  let refreshToken = tokens.refreshToken
  if (!refreshToken) {
    const existing = await getCalendarConnection(userId, provider)
    refreshToken = existing?.refresh_token ?? ''
  }
  if (!refreshToken) return false

  const { error } = await supabase.from('calendar_connections').upsert(
    {
      user_id: userId,
      provider,
      access_token: tokens.accessToken,
      refresh_token: refreshToken,
      expires_at: tokens.expiresAt.toISOString(),
      account_email: tokens.accountEmail ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider' },
  )

  if (error) {
    console.error('upsertCalendarConnection failed:', error.message)
    return false
  }
  return true
}

export async function deleteCalendarConnection(
  userId: string,
  provider: CalendarProvider,
): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return false

  const { error } = await supabase
    .from('calendar_connections')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider)

  return !error
}

export async function createOAuthState(
  userId: string,
  provider: CalendarProvider,
  state: string,
  expiresAt: Date,
): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return false

  const { error } = await supabase.from('calendar_oauth_states').insert({
    state,
    user_id: userId,
    provider,
    expires_at: expiresAt.toISOString(),
  })

  return !error
}

export async function consumeOAuthState(
  state: string,
): Promise<{ userId: string; provider: CalendarProvider } | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('calendar_oauth_states')
    .select('user_id, provider, expires_at')
    .eq('state', state)
    .maybeSingle()

  if (error || !data) return null

  await supabase.from('calendar_oauth_states').delete().eq('state', state)

  if (new Date(data.expires_at).getTime() < Date.now()) return null

  return {
    userId: data.user_id as string,
    provider: data.provider as CalendarProvider,
  }
}

export async function updateAccessToken(
  userId: string,
  provider: CalendarProvider,
  accessToken: string,
  expiresAt: Date,
  refreshToken?: string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return false

  const patch: {
    access_token: string
    expires_at: string
    updated_at: string
    refresh_token?: string
  } = {
    access_token: accessToken,
    expires_at: expiresAt.toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (refreshToken) {
    patch.refresh_token = refreshToken
  }

  const { error } = await supabase
    .from('calendar_connections')
    .update(patch)
    .eq('user_id', userId)
    .eq('provider', provider)

  return !error
}
