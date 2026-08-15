import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseEnv } from './env'

/** Supabase client for route handlers — writes session cookies onto the outgoing response. */
export async function createRouteHandlerClient(
  response: NextResponse,
): Promise<SupabaseClient | null> {
  const env = getSupabaseEnv()
  if (!env) return null

  const cookieStore = await cookies()

  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options)
          response.cookies.set(name, value, options)
        })
      },
    },
  })
}
