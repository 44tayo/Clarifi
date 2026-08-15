import type { MetadataRoute } from 'next'
import { BLOG_POST_SLUGS } from '@/lib/blog-posts'
import { getSiteOrigin } from '@/lib/site-url'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteOrigin()
  const lastModified = new Date()

  return [
    {
      url: base,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}/blog`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${base}/pricing`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${base}/privacy`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${base}/terms`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${base}/subprocessors`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    ...BLOG_POST_SLUGS.map((slug) => ({
      url: `${base}/blog/${slug}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ]
}
