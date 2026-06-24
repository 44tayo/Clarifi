import Image from 'next/image'
import Link from 'next/link'
import type { BlogBlock } from '@/lib/blog-posts'

type BlogPostContentProps = {
  blocks: BlogBlock[]
  image?: string
  imageAlt?: string
}

export function BlogPostContent({ blocks, image, imageAlt }: BlogPostContentProps) {
  return (
    <div className="blog-post-body">
      {image ? (
        <figure className="blog-post-hero">
          <Image
            src={image}
            alt={imageAlt ?? ''}
            width={1200}
            height={675}
            className="blog-post-hero-img"
            priority
          />
        </figure>
      ) : null}

      {blocks.map((block, index) => {
        switch (block.type) {
          case 'p':
            return (
              <p key={index} className={block.strong ? 'blog-post-strong' : undefined}>
                {block.text}
              </p>
            )
          case 'h2':
            return (
              <h2 key={index} id={block.id} className="blog-post-h2">
                {block.text}
              </h2>
            )
          case 'h3':
            return (
              <h3 key={index} className="blog-post-h3">
                {block.text}
              </h3>
            )
          case 'ul':
            return (
              <ul key={index} className="blog-post-list">
                {block.items.map((item) => (
                  <li key={item.slice(0, 32)}>{item}</li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={index} className="blog-post-list blog-post-list-ol">
                {block.items.map((item) => (
                  <li key={item.slice(0, 32)}>{item}</li>
                ))}
              </ol>
            )
          case 'table':
            return (
              <div key={index} className="blog-post-table-wrap">
                <table className="blog-post-table">
                  <thead>
                    <tr>
                      {block.headers.map((header) => (
                        <th key={header}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row) => (
                      <tr key={row.join('|')}>
                        {row.map((cell) => (
                          <td key={cell.slice(0, 24)}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'cta':
            return (
              <div key={index} className="blog-post-cta">
                <p>{block.text}</p>
                <Link href={block.href} className="blog-post-cta-btn">
                  {block.label}
                </Link>
              </div>
            )
          case 'link':
            return block.external ? (
              <p key={index} className="blog-post-link-wrap">
                <a
                  href={block.href}
                  className="blog-post-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {block.text}
                </a>
              </p>
            ) : (
              <p key={index} className="blog-post-link-wrap">
                <Link href={block.href} className="blog-post-link">
                  {block.text}
                </Link>
              </p>
            )
          case 'hr':
            return <hr key={index} className="blog-post-hr" />
          default:
            return null
        }
      })}
    </div>
  )
}
