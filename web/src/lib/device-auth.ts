import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { isCreator } from './creator'
import { getSupabaseAdmin } from './supabase-admin'

const AUTH_TOKEN_TTL_MS = 5 * 60 * 1000

function pepper(): string {
  return (
    process.env.DEVICE_AUTH_PEPPER?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    'clarifi-device-dev-pepper'
  )
}

export function hashDeviceSecret(deviceId: string, secret: string): string {
  return createHash('sha256').update(`${pepper()}:${deviceId}:${secret}`).digest('hex')
}

export async function createDesktopAuthToken(
  userId: string,
): Promise<{ token: string; expiresAt: string } | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + AUTH_TOKEN_TTL_MS).toISOString()

  const { error } = await supabase.from('desktop_auth_tokens').insert({
    token,
    clerk_user_id: userId,
    expires_at: expiresAt,
  })

  if (error) {
    console.error('createDesktopAuthToken failed:', error.message)
    return null
  }

  return { token, expiresAt }
}

export async function exchangeDesktopAuthToken(
  token: string,
  deviceId: string,
  deviceSecret: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return { ok: false, error: 'storage_unavailable' }

  const { data, error } = await supabase
    .from('desktop_auth_tokens')
    .select('clerk_user_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()

  if (error || !data) return { ok: false, error: 'invalid_token' }
  if (data.used_at) return { ok: false, error: 'token_used' }

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0
  if (!expiresAt || Date.now() > expiresAt) {
    return { ok: false, error: 'token_expired' }
  }

  const { count: profileCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', data.clerk_user_id)

  if (!profileCount) {
    const { data: authUser } = await supabase.auth.admin.getUserById(
      data.clerk_user_id,
    )
    const email = authUser?.user?.email ?? null
    await supabase.from('profiles').insert({
      user_id: data.clerk_user_id,
      email,
      plan: isCreator(data.clerk_user_id, email) ? 'pro_plus' : 'free',
      updated_at: new Date().toISOString(),
    })
  }

  const { error: deviceError } = await supabase.from('desktop_devices').upsert(
    {
      device_id: deviceId,
      secret_hash: hashDeviceSecret(deviceId, deviceSecret),
      clerk_user_id: data.clerk_user_id,
      paired_at: new Date().toISOString(),
      pairing_code: null,
      pairing_expires_at: null,
    },
    { onConflict: 'device_id' },
  )

  if (deviceError) return { ok: false, error: 'exchange_failed' }

  await supabase
    .from('desktop_auth_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)

  return { ok: true }
}

export async function getUserIdFromDeviceRequest(req: Request): Promise<string | null> {
  const deviceId = req.headers.get('X-Clarifi-Device-Id')?.trim()
  const deviceSecret = req.headers.get('X-Clarifi-Device-Secret')?.trim()
  if (!deviceId || !deviceSecret) return null

  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('desktop_devices')
    .select('secret_hash, clerk_user_id')
    .eq('device_id', deviceId)
    .maybeSingle()

  if (error || !data?.clerk_user_id || !data.secret_hash) return null

  const expected = Buffer.from(data.secret_hash, 'hex')
  const actual = Buffer.from(hashDeviceSecret(deviceId, deviceSecret), 'hex')
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null
  }

  return data.clerk_user_id
}
