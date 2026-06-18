import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { BlogPostContent } from '@/components/blog/BlogPostContent'
import { WaitlistSiteFooter } from '@/components/waitlist/WaitlistPageSections'
import { BLOG_POST_SLUGS, getBlogPost } from '@/lib/blog-posts'
import '@/components/waitlist/waitlist.css'
import '../../landing-blog.css'

type PageProps = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return BLOG_POST_SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) return { title: 'Blog — Clarifi' }
  return {
    title: `${post.metaTitle} — Clarifi Blog`,
    description: post.metaDescription,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.metaTitle,
      description: post.metaDescription,
      type: 'article',
      url: `/blog/${slug}`,
      images: [{ url: post.image, alt: post.imageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.metaTitle,
      description: post.metaDescription,
      images: [post.image],
    },
  }
}

function FaqJsonLd({ slug }: { slug: string }) {
  const post = getBlogPost(slug)
  if (!post) return null

  const faqStart = post.blocks.findIndex((b) => b.type === 'h2' && b.id === 'faq')
  if (faqStart < 0) return null

  const faqItems: { question: string; answer: string }[] = []
  for (let i = faqStart + 1; i < post.blocks.length; i += 1) {
    const block = post.blocks[i]
    if (block.type === 'h2') break
    if (block.type !== 'h3') continue
    const next = post.blocks[i + 1]
    if (next?.type === 'p') {
      faqItems.push({ question: block.text, answer: next.text })
    }
  }

  if (faqItems.length === 0) return null

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) notFound()

  return (
    <div className="blog-root landing-root waitlist-page">
      <FaqJsonLd slug={slug} />
      <MarketingNav active="blog" showBack />
      <article className="blog-post" data-reveal>
        <h1>{post.title}</h1>
        <p className="blog-post-meta">
          {post.date} · {post.readTime}
        </p>
        <BlogPostContent blocks={post.blocks} image={post.image} imageAlt={post.imageAlt} />
        <p className="blog-post-back">
          <Link href="/blog">← All posts</Link>
        </p>
      </article>
      <WaitlistSiteFooter />
    </div>
  )
}
