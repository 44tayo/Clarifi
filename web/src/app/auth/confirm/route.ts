import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { AUTH_NEXT_COOKIE, resolveAuthNext } from '@/lib/auth-next'
import { consumeRateLimit, getClientIp } from '@/lib/ip-rate-limit'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'

export const dynamic = 'force-dynamic'

const CONFIRM_LIMIT = 20
const CONFIRM_WINDOW_SECONDS = 10 * 60

function buildRedirect(request: Request, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url))
  response.cookies.set(AUTH_NEXT_COOKIE, '', { path: '/', maxAge: 0 })
  return response
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const cookieStore = await cookies()
  const authNextCookie = cookieStore.get(AUTH_NEXT_COOKIE)?.value ?? null
  const safeNext = resolveAuthNext(
    searchParams.get('next') ?? (authNextCookie ? decodeURIComponent(authNextCookie) : null),
    '/dashboard',
  )

  if (!tokenHash || !type || !getSupabaseEnv()) {
    return buildRedirect(request, '/sign-in?error=auth')
  }

  const ip = getClientIp(request)
  const limit = await consumeRateLimit(`auth_confirm:ip:${ip}`, CONFIRM_LIMIT, CONFIRM_WINDOW_SECONDS)
  if (!limit.allowed) {
    return buildRedirect(request, '/sign-in?error=rate_limited')
  }

  let response = buildRedirect(request, safeNext)
  const supabase = await createRouteHandlerClient(response)
  if (!supabase) {
    return buildRedirect(request, '/sign-in?error=auth')
  }

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

  if (error) {
    console.error('auth confirm verify failed:', error.message)
    return buildRedirect(
      request,
      `/sign-in?next=${encodeURIComponent(safeNext)}&error=auth`,
    )
  }

  return response
}
