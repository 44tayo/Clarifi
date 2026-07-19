export const AUTH_NEXT_COOKIE = 'clarifi_auth_next'
export const AUTH_NEXT_MAX_AGE = 600

export function authNextCookieValue(next: string): string {
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
  return `${AUTH_NEXT_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=${AUTH_NEXT_MAX_AGE}; SameSite=Lax${secure}`
}

export function resolveAuthNext(next: string | null | undefined, fallback = '/dashboard'): string {
  if (next && next.startsWith('/') && next !== '/') return next
  return fallback
}

export function isBillingCheckoutNext(next: string): boolean {
  const path = next.split('?')[0] || next
  return path === '/billing' || path === '/checkout'
}
