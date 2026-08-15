import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseEnv, type SupabasePublicConfig } from './env'

export function createClient(config?: SupabasePublicConfig | null): SupabaseClient | null {
  const env = config ?? getSupabaseEnv()
  if (!env) return null
  return createBrowserClient(env.url, env.key)
}
