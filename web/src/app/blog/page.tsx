import { BlogIndex } from '@/components/blog/BlogIndex'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { MarketingSiteFooter } from '@/components/marketing/MarketingSiteFooter'
import { BLOG_POSTS } from '@/lib/blog-posts'
import '@/components/marketing/marketing.css'
import '../landing-blog.css'

export const metadata = {
  title: 'Blog — Clarifi',
  description:
    'Meeting tips, AI notetaker guides, and product updates from Clarifi — your AI meeting notepad.',
  alternates: { canonical: '/blog' },
}

export default function BlogPage() {
  return (
    <div className="blog-root landing-root marketing-page">
      <MarketingNav active="blog" showBack />
      <BlogIndex posts={BLOG_POSTS} />
      <MarketingSiteFooter />
    </div>
  )
}
