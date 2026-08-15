import Link from 'next/link'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { SUBPROCESSORS } from '@/lib/subprocessors'
import '../legal.css'

export const metadata = {
  title: 'Subprocessors — Clarifi',
  description: 'Third-party subprocessors that may process data on behalf of Clarifi.',
  alternates: { canonical: '/subprocessors' },
}

export default function SubprocessorsPage() {
  return (
    <div className="legal-root">
      <MarketingNav />

      <div className="legal-layout legal-layout-single">
        <main className="legal-main" data-reveal>
          <h1>Clarifi Subprocessors</h1>
          <p className="legal-updated">Current as of 8 June 2026</p>

          <p>
            Know exactly where your data is and how it is being used. The following third parties
            (&quot;subprocessors&quot;) may process personal data on Clarifi&apos;s behalf to deliver
            the Services. This list may be updated as our infrastructure changes.
          </p>

          <div className="legal-table-wrap">
            <table className="legal-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Purpose</th>
                  <th scope="col">Location</th>
                  <th scope="col">Website</th>
                </tr>
              </thead>
              <tbody>
                {SUBPROCESSORS.map((row) => (
                  <tr key={row.name}>
                    <td className="legal-table-name">{row.name}</td>
                    <td>{row.purpose}</td>
                    <td>{row.location}</td>
                    <td>
                      <a href={row.website} target="_blank" rel="noopener noreferrer">
                        {row.website.replace(/^https?:\/\//, '')}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p>
            Questions about subprocessors or data processing? Contact us at{' '}
            <a href="mailto:tayowilliams23@gmail.com">tayowilliams23@gmail.com</a>.
          </p>
          <p>
            Related: <Link href="/privacy">Privacy Policy</Link> ·{' '}
            <Link href="/terms">Terms of Service</Link>
          </p>
          <p>
            <Link href="/">← Back to home</Link>
          </p>
        </main>
      </div>
    </div>
  )
}
