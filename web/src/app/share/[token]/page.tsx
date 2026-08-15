import type { Metadata } from 'next'
import Link from 'next/link'

import { getServerUser } from '@/lib/auth-server'
import { getSharedMeetingByToken } from '@/lib/share-notes'

type PageProps = { params: Promise<{ token: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params
  const user = await getServerUser()
  const shared = await getSharedMeetingByToken(token, user?.email)
  return {
    title: shared ? `${shared.title} — Clarifi` : 'Shared notes — Clarifi',
  }
}

export default async function SharedMeetingPage({ params }: PageProps) {
  const { token } = await params
  const user = await getServerUser()
  const shared = await getSharedMeetingByToken(token, user?.email)

  if (!shared) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold text-[color:var(--ds-ink)]">Link not found</h1>
        <p className="mt-3 text-[color:var(--ds-muted)]">
          This share link may have expired or been removed.
        </p>
        <Link href="/" className="mt-6 inline-block text-[color:var(--ds-blue)]">
          Go to Clarifi
        </Link>
      </main>
    )
  }

  const content = shared.content
  const summary =
    (typeof content.enhancedNotes === 'string' && content.enhancedNotes) ||
    (typeof content.summary === 'string' && content.summary) ||
    ''
  const actionItems = Array.isArray(content.actionItems)
    ? content.actionItems.filter((item): item is string => typeof item === 'string')
    : []
  const attendees = Array.isArray(content.attendees)
    ? content.attendees.filter((item): item is string => typeof item === 'string')
    : []
  const endedAt =
    typeof content.endedAt === 'number'
      ? new Intl.DateTimeFormat(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(content.endedAt))
      : null

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm font-medium text-[color:var(--ds-muted)]">Shared with Clarifi</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--ds-ink)]">
        {shared.title}
      </h1>
      <div className="mt-3 flex flex-wrap gap-3 text-sm text-[color:var(--ds-muted)]">
        {endedAt ? <span>{endedAt}</span> : null}
        {attendees.length > 0 ? (
          <span>
            {attendees.length} participant{attendees.length === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>

      {actionItems.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-[color:var(--ds-ink)]">Action items</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[color:var(--ds-ink)]">
            {actionItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-[color:var(--ds-ink)]">AI Summary</h2>
        <pre className="mt-3 whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-[color:var(--ds-ink)]">
          {summary || 'No summary included in this share.'}
        </pre>
      </section>

      {typeof content.userNotes === 'string' && content.userNotes.trim() ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-[color:var(--ds-ink)]">My notes</h2>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-[color:var(--ds-ink)]">
            {content.userNotes}
          </pre>
        </section>
      ) : null}

      {Array.isArray(content.transcript) && content.transcript.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-[color:var(--ds-ink)]">Transcript</h2>
          <ul className="mt-3 space-y-3">
            {content.transcript.map((line, index) => {
              const speaker =
                typeof line?.speaker === 'string' && line.speaker.trim()
                  ? line.speaker
                  : 'Speaker'
              const text = typeof line?.text === 'string' ? line.text : ''
              if (!text.trim()) return null
              return (
                <li key={`${speaker}-${index}`} className="text-[15px] leading-relaxed">
                  <span className="font-semibold text-[color:var(--ds-muted)]">{speaker}</span>
                  <span className="text-[color:var(--ds-ink)]"> — {text}</span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <p className="mt-12 text-sm text-[color:var(--ds-muted)]">
        <Link href="/" className="text-[color:var(--ds-blue)]">
          Clarifi
        </Link>{' '}
        — AI meeting notes without a bot in the call.
      </p>
    </main>
  )
}
