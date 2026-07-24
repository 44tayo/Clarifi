import { useMemo, useState } from 'react'

import { FolderPicker } from './FolderPicker'
import type { Folder, Meeting } from '../types/meeting'

type MeetingMetaBarProps = {
  meeting: Meeting
  folders: Folder[]
  onSetFolders: (folderIds: string[]) => void
  onCreateFolder: (name: string) => Promise<Folder | void> | Folder | void
  onRenameSpeaker: (speakerKey: string, label: string) => void
  documentLayout?: boolean
}

function formatMeetingTime(meeting: Meeting): string {
  const start = meeting.startedAt ?? meeting.scheduledStart ?? meeting.createdAt
  const end = meeting.endedAt
  const startDate = new Date(start)
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(startDate)
  const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  const startTime = new Intl.DateTimeFormat(undefined, timeOpts).format(startDate)
  if (!end) return `${weekday}, ${startTime}`
  const endTime = new Intl.DateTimeFormat(undefined, timeOpts).format(new Date(end))
  return `${weekday}, ${startTime} – ${endTime}`
}

function uniqueTranscriptSpeakers(meeting: Meeting): string[] {
  const seen = new Set<string>()
  const keys: string[] = []
  for (const entry of meeting.transcript) {
    if (seen.has(entry.speaker)) continue
    seen.add(entry.speaker)
    keys.push(entry.speaker)
  }
  return keys
}

function snippetForSpeaker(meeting: Meeting, speaker: string): string {
  const line = meeting.transcript.find((entry) => entry.speaker === speaker)
  if (!line) return ''
  const text = line.text.trim()
  if (text.length <= 72) return text
  return `${text.slice(0, 69)}…`
}

function isNamed(meeting: Meeting, speakerKey: string): boolean {
  const label = meeting.speakerLabels?.[speakerKey]?.trim()
  return Boolean(label && label !== speakerKey)
}

export function MeetingMetaBar({
  meeting,
  folders,
  onSetFolders,
  onCreateFolder,
  onRenameSpeaker,
  documentLayout = false,
}: MeetingMetaBarProps) {
  const [folderOpen, setFolderOpen] = useState(false)
  const [speakersOpen, setSpeakersOpen] = useState(false)
  const selectedFolderIds = meeting.folderIds ?? []
  const speakerKeys = useMemo(() => uniqueTranscriptSpeakers(meeting), [meeting])
  const namedCount = speakerKeys.filter((key) => isNamed(meeting, key)).length
  const allNamed = speakerKeys.length > 0 && namedCount === speakerKeys.length
  const selectedFolders = folders.filter((folder) => selectedFolderIds.includes(folder.id))

  if (!documentLayout) {
    return (
      <div className="meeting-meta-bar">
        <span className="meta-pill is-static">{formatMeetingTime(meeting)}</span>
        <div className="meta-pill-wrap">
          <button
            type="button"
            className="meta-pill"
            onClick={() => {
              setFolderOpen((v) => !v)
              setSpeakersOpen(false)
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
      </div>
    )
  }

  return (
    <div className="meeting-meta-rows">
      <div className="meeting-meta-row">
        <span className="meeting-meta-label">Time</span>
        <span className="meeting-meta-value">{formatMeetingTime(meeting)}</span>
      </div>

      <div className="meeting-meta-row">
        <span className="meeting-meta-label">Speakers</span>
        <div className="meeting-meta-value meeting-meta-speakers">
          {allNamed ? (
            <div className="meeting-speaker-chips">
              {speakerKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="meeting-speaker-chip"
                  onClick={() => {
                    setSpeakersOpen(true)
                    setFolderOpen(false)
                  }}
                >
                  {meeting.speakerLabels?.[key]?.trim() || key}
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              className="name-speakers-cta"
              onClick={() => {
                setSpeakersOpen((v) => !v)
                setFolderOpen(false)
              }}
            >
              Name speakers
            </button>
          )}
          {speakersOpen ? (
            <div className="name-speakers-popover" role="dialog" aria-label="Speakers">
              <div className="name-speakers-popover-header">
                <span>Speakers</span>
                <span className="name-speakers-count">
                  {namedCount} of {speakerKeys.length} named
                </span>
              </div>
              {speakerKeys.length === 0 ? (
                <p className="meta-popover-empty">No speakers in the transcript yet.</p>
              ) : (
                <ul className="name-speakers-list">
                  {speakerKeys.map((key) => (
                    <li key={key} className="name-speakers-item">
                      <input
                        className="name-speakers-input"
                        placeholder={`Assign ${key}`}
                        defaultValue={meeting.speakerLabels?.[key] ?? ''}
                        onBlur={(event) => {
                          const value = event.target.value.trim()
                          if (value) onRenameSpeaker(key, value)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            ;(event.target as HTMLInputElement).blur()
                          }
                        }}
                      />
                      <p className="name-speakers-snippet">{snippetForSpeaker(meeting, key)}</p>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="link-btn name-speakers-done"
                onClick={() => setSpeakersOpen(false)}
              >
                Done
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="meeting-meta-row">
        <span className="meeting-meta-label">Folders</span>
        <div className="meeting-meta-value meeting-meta-folders">
          {selectedFolders.map((folder) => (
            <span key={folder.id} className="meeting-folder-chip">
              {folder.name}
            </span>
          ))}
          <div className="meta-pill-wrap">
            <button
              type="button"
              className="meeting-folder-add"
              onClick={() => {
                setFolderOpen((v) => !v)
                setSpeakersOpen(false)
              }}
              aria-label="Add to folder"
            >
              +
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
        </div>
      </div>
    </div>
  )
}
