import { useMemo, useState } from 'react'

import { searchMeetings } from '../lib/commandPalette'
import { MeetingRow } from './MeetingRow'
import type { ConnectionStatus, Meeting } from '../types/meeting'

type MeetingsListViewProps = {
  title: string
  subtitle?: string
  meetings: Meeting[]
  selectedId: string | null
  connection: ConnectionStatus
  onSelectMeeting: (id: string) => void
  onOpenDashboard: () => void
  isMeetingLocked: (meeting: Meeting) => boolean
}

export function MeetingsListView({
  title,
  subtitle,
  meetings,
  selectedId,
  onSelectMeeting,
  onOpenDashboard,
  isMeetingLocked,
}: MeetingsListViewProps) {
  const [query, setQuery] = useState('')

  const visibleMeetings = useMemo(() => {
    if (!query.trim()) return meetings
    return searchMeetings(meetings, query, meetings.length)
  }, [meetings, query])

  return (
    <div className="meetings-list-view">
      <header className="home-view-header">
        <div>
          <h1 className="home-view-title">{title}</h1>
          {subtitle ? <p className="home-view-subtitle">{subtitle}</p> : null}
        </div>
      </header>

      <div className="meetings-list-search">
        <svg className="meetings-list-search-icon" width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M13 13l-2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search meetings, notes, transcripts…"
          aria-label="Search meetings"
        />
      </div>

      <div className="meetings-list-body">
        {visibleMeetings.length === 0 ? (
          <p className="home-muted">
            {query.trim() ? 'No meetings match your search.' : 'No meetings in this list yet.'}
          </p>
        ) : (
          visibleMeetings.map((meeting) => {
            const locked = isMeetingLocked(meeting)
            return (
              <MeetingRow
                key={meeting.id}
                meeting={meeting}
                active={meeting.id === selectedId}
                locked={locked}
                onSelect={locked ? () => onOpenDashboard() : onSelectMeeting}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
