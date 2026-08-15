import type { MetadataRoute } from 'next'
import { getSiteOrigin } from '@/lib/site-url'

export default function robots(): MetadataRoute.Robots {
  const base = getSiteOrigin()

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/blog', '/privacy', '/terms', '/subprocessors'],
      disallow: [
        '/preview',
        '/dashboard',
        '/billing',
        '/checkout',
        '/sign-in',
        '/sign-up',
        '/desktop/',
        '/api/',
        '/auth/',
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
