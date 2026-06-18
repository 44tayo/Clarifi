'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import type { BlogCategory, BlogPost } from '@/lib/blog-posts'
import {
  authorInitials,
  formatPostDay,
  groupPostsByMonth,
  sortBlogPosts,
} from '@/lib/blog-utils'

function FilterIcon({ kind }: { kind: BlogCategory }) {
  if (kind === 'announcement') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2zm-7 14l1 3.5L9 20l-3-1.5L3 20l1-3.5L3 13l3 1.5L9 13l-1 3.5L9 20l-3-1.5L2 16l3-1.5z" />
      </svg>
    )
  }
  if (kind === 'press') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 4h12a2 2 0 0 1 2 2v14l-4-3-4 3-4-3-4 3V6a2 2 0 0 1 2-2z" />
    </svg>
  )
}

function TimelineIcon({ category }: { category: BlogCategory }) {
  return (
    <div className={`blog-timeline-icon blog-timeline-icon-${category}`} aria-hidden>
      <FilterIcon kind={category} />
    </div>
  )
}

function AuthorMeta({ post }: { post: BlogPost }) {
  const initials = authorInitials(post.author.name)
  return (
    <div className="blog-timeline-meta">
      {post.author.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.author.avatar} alt="" className="blog-timeline-avatar" />
      ) : (
        <span className="blog-timeline-avatar blog-timeline-avatar-fallback">{initials}</span>
      )}
      <span className="blog-timeline-author">{post.author.name}</span>
      <span className="blog-timeline-date">{formatPostDay(post.date)}</span>
    </div>
  )
}

function PostEntry({ post, featured }: { post: BlogPost; featured?: boolean }) {
  const content = (
    <>
      <h2 className="blog-timeline-title">
        {post.title}
        {post.externalUrl ? (
          <span className="blog-timeline-external" aria-hidden>
            ↗
          </span>
        ) : null}
      </h2>
      <AuthorMeta post={post} />
    </>
  )

  const className = `blog-timeline-entry${featured ? ' blog-timeline-entry-featured' : ''}`

  if (post.externalUrl) {
    return (
      <article className={className}>
        <a href={post.externalUrl} target="_blank" rel="noopener noreferrer" className="blog-timeline-link">
          {content}
        </a>
      </article>
    )
  }

  return (
    <article className={className}>
      <Link href={`/blog/${post.slug}`} className="blog-timeline-link">
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
  const groups = useMemo(() => groupPostsByMonth(sorted), [sorted])
  const featuredSlug = sorted.find((p) => p.featured)?.slug

  return (
    <div className="blog-timeline" data-reveal-group>
      {groups.length === 0 ? (
        <p className="blog-timeline-empty">No posts yet.</p>
      ) : (
        groups.map((group) => (
          <section key={group.month} className="blog-timeline-month">
            <h2 className="blog-timeline-month-label">{group.month}</h2>
            <div className="blog-timeline-list">
              {group.posts.map((post) => (
                <div key={post.slug} className="blog-timeline-row">
                  <div className="blog-timeline-spine">
                    <TimelineIcon category={post.category} />
                  </div>
                  <PostEntry post={post} featured={post.slug === featuredSlug} />
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
