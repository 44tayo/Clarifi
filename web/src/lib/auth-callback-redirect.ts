import { resolveAuthNext } from './auth-next'

/** When Supabase sends OAuth to Site URL (/?code=...), forward to /auth/callback. */
export function authCallbackRedirectPath(
  searchParams: URLSearchParams,
  authNextCookie?: string | null,
): string | null {
  if (!searchParams.get('code')) return null

  const callback = new URLSearchParams(searchParams)
  if (!callback.has('next') || callback.get('next') === '/') {
    const fromCookie = authNextCookie ? decodeURIComponent(authNextCookie) : null
    callback.set('next', resolveAuthNext(fromCookie))
  }
  return `/auth/callback?${callback.toString()}`
}
