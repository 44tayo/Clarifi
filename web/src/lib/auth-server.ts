import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function getServerUser(): Promise<User | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

export async function getServerUserId(): Promise<string | null> {
  const user = await getServerUser()
  return user?.id ?? null
}
