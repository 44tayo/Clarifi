import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { resolveAuthNext } from '@/lib/auth-next'
import { authCallbackRedirectPath } from '@/lib/auth-callback-redirect'
import {
  LAUNCH_PREVIEW_COOKIE,
  resolveLaunchPreviewState,
} from '@/lib/launch-preview'
import { applyLaunchPreviewCookies } from '@/lib/launch-preview-server'
import { resolvePostAuthRedirect, shouldBlockPrelaunchAccess } from '@/lib/prelaunch'
import { isPublicPath } from '@/lib/protected-routes'
import { CANONICAL_SITE_HOST, shouldRedirectToCanonicalHost } from '@/lib/site-url'
import { isLaunchLive } from '@/lib/waitlist-config'

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )?.trim()
  if (!url || !key) return null
  return { url, key }
}

export default async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const host = request.headers.get('host') ?? ''

  if (shouldRedirectToCanonicalHost(host)) {
    const canonical = request.nextUrl.clone()
    canonical.hostname = CANONICAL_SITE_HOST
    canonical.protocol = 'https:'
    return NextResponse.redirect(canonical, 308)
  }

  if (
    pathname === '/live' ||
    pathname === '/prelaunch'
  ) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (pathname.startsWith('/preview')) {
    return NextResponse.redirect(new URL('/?preview=live', request.url))
  }

  if (
    searchParams.get('code') &&
    pathname !== '/auth/callback' &&
    !pathname.startsWith('/api/integrations/hubspot/callback') &&
    !pathname.startsWith('/api/integrations/gmail/callback')
  ) {
    const authNext = request.cookies.get('clarifi_auth_next')?.value ?? null
    const target = authCallbackRedirectPath(searchParams, authNext)
    if (target) {
      return NextResponse.redirect(new URL(target, request.url))
    }
  }

  if (
    searchParams.get('token_hash') &&
    searchParams.get('type') &&
    pathname !== '/auth/confirm'
  ) {
    const confirm = new URL('/auth/confirm', request.url)
    searchParams.forEach((value, key) => {
      confirm.searchParams.set(key, value)
    })
    return NextResponse.redirect(confirm)
  }

  let response = NextResponse.next({ request })
  const launchPreview = resolveLaunchPreviewState(
    searchParams,
    request.cookies.get(LAUNCH_PREVIEW_COOKIE)?.value ?? null,
  )

  applyLaunchPreviewCookies(response, searchParams.get('preview'))

  const env = getSupabaseEnv()

  if (env) {
    const supabase = createServerClient(env.url, env.key, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (
      shouldBlockPrelaunchAccess(
        pathname,
        user?.id,
        launchPreview.previewLive,
        launchPreview.forceWaitlist,
      )
    ) {
      const home = new URL('/', request.url)
      if (user) home.searchParams.set('joined', '1')
      const redirectResponse = NextResponse.redirect(home)
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie)
      })
      return redirectResponse
    }

    if (pathname === '/sign-in' || pathname === '/sign-up') {
      if (user) {
        const next = resolveAuthNext(searchParams.get('next'), '/dashboard')
        const dest = isLaunchLive(
          undefined,
          launchPreview.previewLive,
          launchPreview.forceWaitlist,
        )
          ? next
          : resolvePostAuthRedirect(
              next,
              launchPreview.previewLive,
              launchPreview.forceWaitlist,
            )
        const redirectResponse = NextResponse.redirect(new URL(dest, request.url))
        response.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie)
        })
        return redirectResponse
      }
    }

    if (!isPublicPath(pathname)) {
      if (!user) {
        const signIn = new URL('/sign-in', request.url)
        signIn.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
        if (launchPreview.previewLive) signIn.searchParams.set('preview', 'live')
        const redirectResponse = NextResponse.redirect(signIn)
        response.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie)
        })
        return redirectResponse
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|xml|txt|dmg|exe)).*)',
    '/(api|trpc)(.*)',
  ],
}
