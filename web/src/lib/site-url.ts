const DEFAULT_SITE_URL = 'https://www.clarifiapp.com'

export const CANONICAL_SITE_HOST = 'www.clarifiapp.com'

export function isClarifiProductionHost(hostname: string): boolean {
  return hostname === 'clarifiapp.com' || hostname === 'www.clarifiapp.com'
}

/** Redirect bare domain to www so OAuth PKCE cookies stay on one origin. */
export function shouldRedirectToCanonicalHost(host: string): boolean {
  return host === 'clarifiapp.com'
}

/** Canonical origin for OAuth redirects — avoids www/non-www PKCE cookie mismatches. */
export function getSiteOrigin(requestOrigin?: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  if (fromEnv) return fromEnv

  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location
    if (isClarifiProductionHost(hostname)) {
      return DEFAULT_SITE_URL
    }
    return origin
  }

  if (requestOrigin) {
    try {
      const host = new URL(requestOrigin).hostname
      if (isClarifiProductionHost(host)) {
        return DEFAULT_SITE_URL
      }
      return requestOrigin.replace(/\/$/, '')
    } catch {
      return DEFAULT_SITE_URL
    }
  }

  return DEFAULT_SITE_URL
}

export function authCallbackUrl(next = '/', origin?: string): string {
  const safeNext = next.startsWith('/') ? next : '/'
  return `${getSiteOrigin(origin)}/auth/callback?next=${encodeURIComponent(safeNext)}`
}
