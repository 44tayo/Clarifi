import { isCreatorUser } from '@/lib/creator'
import { isLaunchLive } from '@/lib/waitlist-config'

/** App surfaces that stay closed until the public launch countdown ends. */
const PRELAUNCH_BLOCKED_PREFIXES = [
  '/dashboard',
  '/desktop/connect',
] as const

export function pathFromNext(next: string): string {
  return next.split('?')[0] || next
}

export function isBillingCheckoutNext(next: string): boolean {
  const path = pathFromNext(next)
  return path === '/billing' || path === '/checkout'
}

export function isPrelaunchBlockedPath(pathname: string): boolean {
  const path = pathFromNext(pathname)
  return PRELAUNCH_BLOCKED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  )
}

/** Sign-in destinations that create an account (not waitlist-only). */
export function isAccountAuthNext(next: string): boolean {
  if (isBillingCheckoutNext(next)) return true
  return isPrelaunchBlockedPath(next)
}

export function isWaitlistAuthNext(next: string): boolean {
  return pathFromNext(next) === '/'
}

/** Whether /sign-in and /sign-up are reachable before public launch. */
export function canAccessAuthDuringPrelaunch(
  next: string,
  previewLive = false,
  forceWaitlist = false,
): boolean {
  if (isLaunchLive(undefined, previewLive, forceWaitlist)) return true
  if (previewLive) return true
  if (isBillingCheckoutNext(next)) return true
  if (isAccountAuthNext(next)) return true
  return false
}

export function resolvePrelaunchAuthNext(
  next: string,
  previewLive = false,
  forceWaitlist = false,
): string {
  if (isLaunchLive(undefined, previewLive, forceWaitlist) || !isPrelaunchBlockedPath(next)) {
    return next
  }
  return '/?joined=1'
}

/** Where to send the user after sign-in during prelaunch. */
export function resolvePostAuthRedirect(
  next: string,
  previewLive = false,
  forceWaitlist = false,
): string {
  if (isLaunchLive(undefined, previewLive, forceWaitlist)) return next
  if (isBillingCheckoutNext(next)) return next
  if (next === '/' || next.startsWith('/?')) return '/?joined=1'
  if (isPrelaunchBlockedPath(next)) return next
  return next
}

/** OAuth callback: waitlist join vs normal account sign-in. */
export function isWaitlistOAuthFlow(
  next: string,
  previewLive = false,
  forceWaitlist = false,
): boolean {
  if (isBillingCheckoutNext(next)) return false
  if (isAccountAuthNext(next)) return false
  if (isLaunchLive(undefined, previewLive, forceWaitlist)) return isWaitlistAuthNext(next)
  return isWaitlistAuthNext(next)
}

export function shouldBlockPrelaunchAccess(
  pathname: string,
  userId?: string | null,
  previewLive = false,
  forceWaitlist = false,
): boolean {
  if (isLaunchLive(undefined, previewLive, forceWaitlist)) return false
  if (
    process.env.NODE_ENV === 'development' &&
    (pathname === '/desktop/connect' || pathname.startsWith('/desktop/connect/'))
  ) {
    return false
  }
  if (!isPrelaunchBlockedPath(pathname)) return false
  if (userId && isCreatorUser(userId)) return false
  return true
}
