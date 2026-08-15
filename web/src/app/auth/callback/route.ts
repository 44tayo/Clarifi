import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { AUTH_NEXT_COOKIE, isBillingCheckoutNext, resolveAuthNext } from '@/lib/auth-next'
import { isCreator } from '@/lib/creator'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'

export const dynamic = 'force-dynamic'

function buildRedirect(request: Request, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url))
  response.cookies.set(AUTH_NEXT_COOKIE, '', { path: '/', maxAge: 0 })
  return response
}

function resolveNextParam(
  searchParams: URLSearchParams,
  authNextCookie: string | null,
): string {
  const fromQuery = searchParams.get('next')
  const fromCookie = authNextCookie ? decodeURIComponent(authNextCookie) : null
  return resolveAuthNext(fromQuery ?? fromCookie, '/dashboard')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const cookieStore = await cookies()
  const authNextCookie = cookieStore.get(AUTH_NEXT_COOKIE)?.value ?? null
  const rawNext = resolveNextParam(searchParams, authNextCookie)
  const successPath = isBillingCheckoutNext(rawNext) ? rawNext : resolveAuthNext(rawNext, '/dashboard')

  if (!code || !getSupabaseEnv()) {
    return buildRedirect(request, '/sign-in?error=auth')
  }

  let response = buildRedirect(request, successPath)

  const supabase = await createRouteHandlerClient(response)
  if (!supabase) {
    return buildRedirect(request, '/sign-in?error=auth')
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('auth callback exchange failed:', error.message)
    return buildRedirect(request, `/sign-in?next=${encodeURIComponent(rawNext)}&error=auth`)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return buildRedirect(request, '/sign-in?error=auth')
  }

  const admin = getSupabaseAdmin()
  if (admin) {
    await admin.from('profiles').upsert(
      {
        user_id: user.id,
        email: user.email,
        plan: isCreator(user.id, user.email) ? 'pro_plus' : 'free',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
  }

  return response
}
