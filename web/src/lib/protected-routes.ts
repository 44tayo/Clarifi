const PUBLIC_PREFIXES = [
  '/',
  '/demo',
  '/sitemap.xml',
  '/robots.txt',
  '/auth/callback',
  '/auth/confirm',
  '/auth/',
  '/blog',
  '/pricing',
  '/billing',
  '/checkout',
  '/privacy',
  '/terms',
  '/subprocessors',
  '/sign-in',
  '/sign-up',
  '/downloads',
  '/download',
  '/desktop/auth',
  '/desktop/connect',
  '/desktop/sign-in',
  '/desktop/sign-up',
  '/desktop/calendar/connect',
  '/desktop/calendar/success',
  '/trust',
  '/api/calendar/callback',
  '/api/calendar/connect',
  '/api/desktop/exchange',
  '/api/desktop/status',
  '/api/desktop/profile',
  '/api/desktop/calendar/events',
  '/api/desktop/calendar/status',
  '/api/desktop/share',
  '/api/desktop/shared-with-me',
  '/api/share',
  '/share',
  '/api/account',
  '/api/llm/chat',
  '/api/llm/suggest',
  '/api/llm/transcribe',
  '/api/llm/diarize',
] as const

export function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith('/preview')) return true
  if (pathname.startsWith('/_next')) return true

  return PUBLIC_PREFIXES.some((prefix) => {
    if (prefix === '/') return pathname === '/'
    return pathname === prefix || pathname.startsWith(`${prefix}/`)
  })
}
