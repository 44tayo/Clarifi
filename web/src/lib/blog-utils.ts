import type { BlogCategory, BlogPost } from './blog-posts'

export function sortBlogPosts(posts: BlogPost[]): BlogPost[] {
  return [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function groupPostsByMonth(posts: BlogPost[]): { month: string; posts: BlogPost[] }[] {
  const sorted = sortBlogPosts(posts)
  const groups: { month: string; posts: BlogPost[] }[] = []

  for (const post of sorted) {
    const month = new Date(post.date)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      .toUpperCase()
    const last = groups[groups.length - 1]
    if (last?.month === month) {
      last.posts.push(post)
    } else {
      groups.push({ month, posts: [post] })
    }
  }

  return groups
}

export function formatPostDay(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function authorInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export const BLOG_CATEGORY_LABELS: Record<BlogCategory, string> = {
  blog: 'Blog',
  announcement: 'Announcements',
  press: 'Press',
}
