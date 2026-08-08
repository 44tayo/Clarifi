import { useMemo } from 'react'

import {
  extractKeyQuotes,
  filterMeetingsByCompany,
  filterMeetingsByPerson,
} from '../../shared/entityMemory'
import { formatMeetingWhen } from '../lib/format'
import type { Meeting } from '../types/meeting'

type EntityMemoryViewProps = {
  kind: 'person' | 'company'
  value: string
  meetings: Meeting[]
  onOpenMeeting: (id: string) => void
  onOpenScopedChat: (scope: 'person' | 'company', value: string) => void
}

export function EntityMemoryView({
  kind,
  value,
  meetings,
  onOpenMeeting,
  onOpenScopedChat,
}: EntityMemoryViewProps) {
  const filtered = useMemo(
    () =>
      kind === 'person'
        ? filterMeetingsByPerson(meetings, value)
        : filterMeetingsByCompany(meetings, value),
    [kind, meetings, value],
  )

  const quotes = useMemo(
    () => filtered.flatMap((meeting) => extractKeyQuotes(meeting, 1)).slice(0, 6),
    [filtered],
  )

  return (
    <div className="entity-memory-view">
      <header className="home-view-header">
        <div>
          <h1 className="home-view-title">{kind === 'person' ? value : value}</h1>
          <p className="home-view-subtitle">
            {kind === 'person'
              ? 'Meetings and memory for this person.'
              : 'Meetings and memory for this company domain.'}
          </p>
        </div>
        <button
          type="button"
          className="primary-btn"
          onClick={() => onOpenScopedChat(kind, value)}
        >
          Chat scoped to this {kind}
        </button>
      </header>

      <section className="entity-memory-section">
        <h2>Timeline</h2>
        {filtered.length === 0 ? (
          <p className="home-view-subtitle">No matching meetings yet.</p>
        ) : (
          <ul className="entity-memory-list">
            {filtered.map((meeting) => (
              <li key={meeting.id}>
                <button type="button" className="link-btn" onClick={() => onOpenMeeting(meeting.id)}>
                  {meeting.title}
                </button>
                <span>{formatMeetingWhen(meeting.startedAt ?? meeting.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="entity-memory-section">
        <h2>Key lines</h2>
        {quotes.length === 0 ? (
          <p className="home-view-subtitle">No quotes yet.</p>
        ) : (
          <ul className="entity-memory-list">
            {quotes.map((quote, index) => (
              <li key={`${index}-${quote.slice(0, 12)}`}>{quote}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
