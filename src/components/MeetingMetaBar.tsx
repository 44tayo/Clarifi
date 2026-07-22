import { useMemo, useState } from 'react'

import { FolderPicker } from './FolderPicker'
import type { Folder, Meeting } from '../types/meeting'

type MeetingMetaBarProps = {
  meeting: Meeting
  folders: Folder[]
  onSetFolders: (folderIds: string[]) => void
  onCreateFolder: (name: string) => Promise<Folder | void> | Folder | void
  onShare?: () => void
  canShare?: boolean
}

function formatMeetingDate(meeting: Meeting): string {
  const at = meeting.endedAt ?? meeting.startedAt ?? meeting.scheduledStart ?? meeting.createdAt
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
  }).format(new Date(at))
}

function participantEntries(meeting: Meeting): { label: string; detail?: string }[] {
  const entries: { label: string; detail?: string }[] = []
  const seen = new Set<string>()

  for (const email of meeting.attendeeEmails ?? []) {
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({ label: email.split('@')[0] || email, detail: email })
  }

  for (const [id, label] of Object.entries(meeting.speakerLabels ?? {})) {
    const key = label.toLowerCase()
    if (seen.has(key) || seen.has(id.toLowerCase())) continue
    seen.add(key)
    entries.push({ label })
  }

  return entries
}

export function MeetingMetaBar({
  meeting,
  folders,
  onSetFolders,
  onCreateFolder,
  onShare,
  canShare,
}: MeetingMetaBarProps) {
  const [folderOpen, setFolderOpen] = useState(false)
  const [participantsOpen, setParticipantsOpen] = useState(false)
  const participants = useMemo(() => participantEntries(meeting), [meeting])
  const selectedFolderIds = meeting.folderIds ?? []

  return (
    <div className="meeting-meta-bar">
      <button type="button" className="meta-pill" disabled>
        {formatMeetingDate(meeting)}
      </button>

      <div className="meta-pill-wrap">
        <button
          type="button"
          className="meta-pill"
          onClick={() => {
            setParticipantsOpen((v) => !v)
            setFolderOpen(false)
          }}
        >
          {participants.length} participant{participants.length === 1 ? '' : 's'}
        </button>
        {participantsOpen ? (
          <div className="meta-popover" role="dialog" aria-label="Participants">
            {participants.length === 0 ? (
              <p className="meta-popover-empty">No participants yet</p>
            ) : (
              <ul className="meta-popover-list">
                {participants.map((person) => (
                  <li key={`${person.label}:${person.detail ?? ''}`}>
                    <span className="meta-popover-name">{person.label}</span>
                    {person.detail ? (
                      <span className="meta-popover-detail">{person.detail}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <div className="meta-pill-wrap">
        <button
          type="button"
          className="meta-pill"
          onClick={() => {
            setFolderOpen((v) => !v)
            setParticipantsOpen(false)
          }}
        >
          Add to folder
        </button>
        <FolderPicker
          open={folderOpen}
          folders={folders}
          selectedFolderIds={selectedFolderIds}
          onChange={onSetFolders}
          onCreateFolder={onCreateFolder}
          onClose={() => setFolderOpen(false)}
        />
      </div>

      {onShare ? (
        <button type="button" className="meta-pill meta-pill-share" onClick={onShare}>
          Share{canShare === false ? '' : ''}
        </button>
      ) : null}
    </div>
  )
}
