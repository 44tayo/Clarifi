import { describe, expect, it } from 'vitest'

/**
 * Mirrors the proxy rule that forwards stray ?code= params to Supabase auth,
 * except for dedicated OAuth callback routes.
 */
function shouldForwardCodeToAuthCallback(pathname: string, hasCode: boolean): boolean {
  if (!hasCode) return false
  if (pathname === '/auth/callback') return false
  if (pathname === '/api/calendar/callback') return false
  return true
}

describe('calendar oauth proxy routing', () => {
  it('does not steal Google calendar callback codes for Supabase auth', () => {
    expect(shouldForwardCodeToAuthCallback('/api/calendar/callback', true)).toBe(false)
  })

  it('still forwards site-url OAuth codes to /auth/callback', () => {
    expect(shouldForwardCodeToAuthCallback('/', true)).toBe(true)
    expect(shouldForwardCodeToAuthCallback('/dashboard', true)).toBe(true)
  })

  it('leaves the auth callback alone', () => {
    expect(shouldForwardCodeToAuthCallback('/auth/callback', true)).toBe(false)
  })

  it('keeps calendar OAuth callback routes public', async () => {
    const { isPublicPath } = await import('../web/src/lib/protected-routes')
    expect(isPublicPath('/api/calendar/callback')).toBe(true)
    expect(isPublicPath('/api/calendar/connect')).toBe(true)
    expect(isPublicPath('/desktop/calendar/success')).toBe(true)
  })

  it('keeps desktop connect public so proxy can skip Supabase getUser', async () => {
    const { isPublicPath } = await import('../web/src/lib/protected-routes')
    expect(isPublicPath('/desktop/connect')).toBe(true)
    expect(isPublicPath('/desktop/sign-in')).toBe(true)
  })

  it('keeps desktop calendar oauth-url public for device-bound connect', async () => {
    const { isPublicPath } = await import('../web/src/lib/protected-routes')
    expect(isPublicPath('/api/desktop/calendar/oauth-url')).toBe(true)
  })

  it('keeps desktop calendar disconnect and communities APIs device-auth reachable', async () => {
    const { isPublicPath } = await import('../web/src/lib/protected-routes')
    expect(isPublicPath('/api/desktop/calendar/disconnect')).toBe(true)
    expect(isPublicPath('/api/communities')).toBe(true)
    expect(isPublicPath('/api/communities/abc/invite')).toBe(true)
    expect(isPublicPath('/api/desktop/meetings')).toBe(true)
  })
})
