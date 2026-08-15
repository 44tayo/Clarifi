import { type CustomerPlatform, isCustomerPlatform } from '@/lib/platform'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function setCustomerPlatform(
  userId: string,
  platform: CustomerPlatform,
): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return false

  const { error } = await supabase.from('profiles').upsert(
    {
      user_id: userId,
      platform,
      platform_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) {
    console.error('setCustomerPlatform failed:', error.message)
    return false
  }

  return true
}

export function parseCustomerPlatformBody(value: unknown): CustomerPlatform | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return isCustomerPlatform(normalized) ? normalized : null
}
