'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Clock } from 'lucide-react'
import { useMemo } from 'react'

import type { BlogPost } from '@/lib/blog-posts'
import { BLOG_CATEGORY_LABELS, sortBlogPosts } from '@/lib/blog-utils'

function BlogCard({ post }: { post: BlogPost }) {
  const content = (
    <>
      <div className="blog-card-media">
        <Image
          src={post.image}
          alt={post.imageAlt}
          width={560}
          height={320}
          className="blog-card-img"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>
      <span className="blog-card-category">{BLOG_CATEGORY_LABELS[post.category]}</span>
      <h2 className="blog-card-title">
        {post.title}
        {post.externalUrl ? (
          <span className="blog-card-external" aria-hidden>
            ↗
          </span>
        ) : null}
      </h2>
      <p className="blog-card-excerpt">{post.excerpt}</p>
      <div className="blog-card-meta">
        <span>{post.author.name}</span>
        <span className="blog-card-meta-dot" aria-hidden>
          ·
        </span>
        <Clock className="blog-card-clock" size={14} strokeWidth={2} aria-hidden />
        <span>{post.readTime}</span>
      </div>
    </>
  )

  if (post.externalUrl) {
    return (
      <article className="blog-card">
        <a
          href={post.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="blog-card-link"
        >
          {content}
        </a>
      </article>
    )
  }

  return (
    <article className="blog-card">
      <Link href={`/blog/${post.slug}`} className="blog-card-link">
        {content}
      </Link>
    </article>
  )
}

type BlogIndexProps = {
  posts: BlogPost[]
}

export function BlogIndex({ posts }: BlogIndexProps) {
  const sorted = useMemo(() => sortBlogPosts(posts), [posts])

  return (
    <div className="blog-grid-wrap" data-reveal-group>
      {sorted.length === 0 ? (
        <p className="blog-grid-empty">No posts yet.</p>
      ) : (
        <div className="blog-grid">
          {sorted.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
