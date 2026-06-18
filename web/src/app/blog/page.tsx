import { BlogIndex } from '@/components/blog/BlogIndex'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { WaitlistSiteFooter } from '@/components/waitlist/WaitlistPageSections'
import { BLOG_POSTS } from '@/lib/blog-posts'
import '@/components/waitlist/waitlist.css'
import '../landing-blog.css'

export const metadata = {
  title: 'Blog — Clarifi',
  description:
    'Meeting tips, AI notetaker guides, and product updates from Clarifi — the invisible AI overlay for every call.',
  alternates: { canonical: '/blog' },
}

export default function BlogPage() {
  return (
    <div className="blog-root landing-root waitlist-page">
      <MarketingNav active="blog" showBack />

      <header className="blog-header" data-reveal>
        <h1>Blog</h1>
        <p>Product updates, meeting tips, and how to get the most from Clarifi.</p>
      </header>

      <BlogIndex posts={BLOG_POSTS} />

      <WaitlistSiteFooter />
    </div>
  )
}
