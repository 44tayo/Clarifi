import { useEffect, useMemo, useRef, useState } from 'react'

import { FolderPicker } from './FolderPicker'
import { TagPicker } from './TagPicker'
import {
  candidatePeopleFromMeeting,
  displayNameForSpeaker,
  emailForSpeaker,
  filterPeopleCandidates,
  isSpeakerIdentified,
  speakerAvatarColor,
  speakerInitials,
  speakerPillSummary,
} from '../../shared/speakers'
import type { SpeakerIdentity } from '../../shared/speakers'
import type { Folder, Meeting, TranscriptEntry } from '../types/meeting'

type MeetingMetaBarProps = {
  meeting: Meeting
  folders: Folder[]
  onSetFolders: (folderIds: string[]) => void
  onCreateFolder: (name: string) => Promise<Folder | void> | Folder | void
  allTags: string[]
  onSetTags: (tags: string[]) => void
  onAssignSpeaker: (speakerKey: string, identity: SpeakerIdentity) => void
  documentLayout?: boolean
  /** Live capture transcript (may be ahead of persisted meeting.transcript). */
  transcriptEntries?: TranscriptEntry[]
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

function formatMeetingDateShort(meeting: Meeting): string {
  const start = meeting.startedAt ?? meeting.scheduledStart ?? meeting.createdAt
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(
    new Date(start),
  )
}

/** Granola-inspired detail line: "Wed 24 Jul · 24/07/2026, 19:23" (+ end if present). */
function formatMeetingDateDetail(meeting: Meeting): string {
  const created = meeting.createdAt
  const start = meeting.startedAt ?? meeting.scheduledStart ?? meeting.createdAt
  const at = created || start
  const end = meeting.endedAt
  const date = new Date(at)
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date)
  const dayMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(date)
  const numeric = new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
  const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
  const time = new Intl.DateTimeFormat(undefined, timeOpts).format(date)
  if (!end) return `${weekday} ${dayMonth} · ${numeric}, ${time}`
  const endTime = new Intl.DateTimeFormat(undefined, timeOpts).format(new Date(end))
  return `${weekday} ${dayMonth} · ${numeric}, ${time} – ${endTime}`
}

function uniqueTranscriptSpeakers(entries: TranscriptEntry[]): string[] {
  const seen = new Set<string>()
  const keys: string[] = []
  for (const entry of entries) {
    if (seen.has(entry.speaker)) continue
    seen.add(entry.speaker)
    keys.push(entry.speaker)
  }
  return keys
}

function snippetForSpeaker(entries: TranscriptEntry[], speaker: string): string {
  const line = entries.find((entry) => entry.speaker === speaker)
  if (!line) return ''
  const text = line.text.trim()
  if (text.length <= 90) return text
  return `${text.slice(0, 87)}…`
}

function canPlaySpeaker(meeting: Meeting, entries: TranscriptEntry[], speaker: string): boolean {
  if (!meeting.recordingPath && meeting.status !== 'live') return false
  if (speaker === 'Me') return false
  return entries.some((entry) => entry.speaker === speaker)
}

type ContactDirectoryPerson = {
  displayName: string
  email?: string
  source: SpeakerIdentity['source']
}

/** Shared across Speakers popover mounts so reopen is instant. */
let speakersContactDirectory: ContactDirectoryPerson[] | null = null
let speakersLocalContacts: ContactDirectoryPerson[] | null = null
let speakersContactNeedsReconnect = false
let speakersContactDirectoryPromise: Promise<void> | null = null

function hasEmail(person: { email?: string }): boolean {
  return Boolean(person.email?.trim())
}

function loadSpeakersContactDirectory(force = false): Promise<void> {
  // null = not loaded yet; [] = loaded empty (must still allow retry via force).
  if (!force && speakersContactDirectory !== null && speakersLocalContacts !== null) {
    return Promise.resolve()
  }
  if (force) {
    speakersContactDirectory = null
    speakersLocalContacts = null
  }
  if (speakersContactDirectoryPromise) return speakersContactDirectoryPromise
  speakersContactDirectoryPromise = Promise.all([
    window.electronAPI.invoke('calendar:contacts-search', { query: '' }),
    window.electronAPI.invoke('contacts:list-local'),
  ])
    .then(([remoteResult, localResult]) => {
      const data = remoteResult as {
        contacts?: Array<{ displayName: string; email?: string; source?: string }>
        needsReconnect?: boolean
      }
      speakersContactNeedsReconnect = Boolean(data?.needsReconnect)
      // Empty-open directory: only contacts with email (drop name-only junk).
      speakersContactDirectory = (data?.contacts ?? [])
        .filter((person) => hasEmail(person))
        .map((person) => ({
          displayName: person.displayName,
          email: person.email,
          source: 'contact' as const,
        }))
      const local = localResult as {
        contacts?: Array<{ displayName: string; email?: string; source?: string }>
      }
      speakersLocalContacts = (local?.contacts ?? []).map((person) => ({
        displayName: person.displayName,
        email: person.email,
        source: 'manual' as const,
      }))
    })
    .catch(() => {
      // Leave null so the next open retries instead of caching a hard failure.
    })
    .finally(() => {
      speakersContactDirectoryPromise = null
    })
  return speakersContactDirectoryPromise
}

async function playSpeakerSnippet(meetingId: string, speaker: string): Promise<boolean> {
  const result = (await window.electronAPI.invoke('meetings:speaker-snippet', {
    meetingId,
    speaker,
  })) as { ok?: boolean; audioBase64?: string; mimeType?: string }
  if (!result?.ok || !result.audioBase64) return false
  const binary = atob(result.audioBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: result.mimeType || 'audio/wav' })
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  await audio.play()
  audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true })
  return true
}

function SpeakerAvatar({ label, seed }: { label: string; seed: string }) {
  return (
    <span
      className="speaker-avatar"
      style={{ background: speakerAvatarColor(seed) }}
      aria-hidden
    >
      {speakerInitials(label)}
    </span>
  )
}

function SpeakersPopover({
  meeting,
  entries,
  speakerKeys,
  onAssignSpeaker,
  onClose,
}: {
  meeting: Meeting
  entries: TranscriptEntry[]
  speakerKeys: string[]
  onAssignSpeaker: (speakerKey: string, identity: SpeakerIdentity) => void
  onClose: () => void
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [playing, setPlaying] = useState<string | null>(null)
  const [contactDirectory, setContactDirectory] = useState<ContactDirectoryPerson[]>(
    () => speakersContactDirectory ?? [],
  )
  const [localContacts, setLocalContacts] = useState<ContactDirectoryPerson[]>(
    () => speakersLocalContacts ?? [],
  )
  const [liveContacts, setLiveContacts] = useState<ContactDirectoryPerson[]>([])
  const [needsReconnect, setNeedsReconnect] = useState(speakersContactNeedsReconnect)
  const [directoryLoading, setDirectoryLoading] = useState(
    speakersContactDirectory === null || speakersLocalContacts === null,
  )
  const [searching, setSearching] = useState(false)
  const [contactsDismissed, setContactsDismissed] = useState(false)
  const playLock = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchSeq = useRef(0)

  const localCandidates = useMemo(
    () =>
      candidatePeopleFromMeeting({
        attendees: meeting.attendees,
        attendeeEmails: meeting.attendeeEmails,
        speakerIdentities: meeting.speakerIdentities,
      }),
    [meeting.attendees, meeting.attendeeEmails, meeting.speakerIdentities],
  )

  const remoteFiltered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const fromDirectory = !q
      ? contactDirectory.slice(0, 40)
      : contactDirectory
          .filter((person) => {
            const name = person.displayName.toLowerCase()
            const email = person.email?.toLowerCase() ?? ''
            return name.includes(q) || email.includes(q)
          })
          .slice(0, 40)

    if (!q) return fromDirectory

    const withEmail: ContactDirectoryPerson[] = []
    const withoutEmail: ContactDirectoryPerson[] = []
    const seen = new Set<string>()
    const push = (person: ContactDirectoryPerson) => {
      const key = person.email?.toLowerCase() || `name:${person.displayName.toLowerCase()}`
      if (seen.has(key)) return
      seen.add(key)
      if (hasEmail(person)) withEmail.push(person)
      else withoutEmail.push(person)
    }
    for (const person of fromDirectory) push(person)
    for (const person of liveContacts) push(person)
    // Prefer emailed contacts; name-only live hits sorted below.
    return [...withEmail, ...withoutEmail].slice(0, 40)
  }, [contactDirectory, liveContacts, query])

  const mergedCandidates = useMemo(() => {
    const seen = new Set<string>()
    const out: Array<{ displayName: string; email?: string; source: SpeakerIdentity['source'] }> =
      []
    const push = (person: {
      displayName: string
      email?: string
      source: SpeakerIdentity['source']
    }) => {
      const key = person.email?.toLowerCase() || `name:${person.displayName.toLowerCase()}`
      if (seen.has(key)) return
      seen.add(key)
      out.push(person)
    }
    for (const person of filterPeopleCandidates(localCandidates, query)) push(person)
    for (const person of filterPeopleCandidates(localContacts, query)) push(person)
    for (const person of remoteFiltered) push(person)
    return out
  }, [localCandidates, localContacts, remoteFiltered, query])

  useEffect(() => {
    if (activeKey && !speakerKeys.includes(activeKey)) {
      setActiveKey(null)
    }
  }, [activeKey, speakerKeys])

  useEffect(() => {
    if (activeKey) {
      const current = displayNameForSpeaker(
        activeKey,
        meeting.speakerIdentities,
        meeting.speakerLabels,
      )
      const identified = isSpeakerIdentified(
        activeKey,
        meeting.speakerIdentities,
        meeting.speakerLabels,
      )
      setQuery(identified ? current : '')
      setContactsDismissed(identified)
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [activeKey, meeting.speakerIdentities, meeting.speakerLabels])

  useEffect(() => {
    if (speakersContactDirectory !== null && speakersLocalContacts !== null) {
      setContactDirectory(speakersContactDirectory)
      setLocalContacts(speakersLocalContacts)
      setNeedsReconnect(speakersContactNeedsReconnect)
      setDirectoryLoading(false)
      return
    }
    setDirectoryLoading(true)
    void loadSpeakersContactDirectory(false).then(() => {
      setContactDirectory(speakersContactDirectory ?? [])
      setLocalContacts(speakersLocalContacts ?? [])
      setNeedsReconnect(speakersContactNeedsReconnect)
      setDirectoryLoading(false)
    })
  }, [])

  // Debounced live search — hits Google Other contacts / People, not just saved Contacts.
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setLiveContacts([])
      setSearching(false)
      return
    }
    const seq = ++searchSeq.current
    const handle = window.setTimeout(() => {
      setSearching(true)
      void window.electronAPI
        .invoke('calendar:contacts-search', { query: q })
        .then((result) => {
          if (seq !== searchSeq.current) return
          const data = result as {
            contacts?: Array<{ displayName: string; email?: string }>
            needsReconnect?: boolean
          }
          if (data?.needsReconnect) setNeedsReconnect(true)
          setLiveContacts(
            (data?.contacts ?? []).map((person) => ({
              displayName: person.displayName,
              email: person.email,
              source: 'contact' as const,
            })),
          )
        })
        .catch(() => {
          if (seq !== searchSeq.current) return
        })
        .finally(() => {
          if (seq === searchSeq.current) setSearching(false)
        })
    }, 120)
    return () => window.clearTimeout(handle)
  }, [query])

  const assign = (identity: SpeakerIdentity) => {
    if (!activeKey) return
    onAssignSpeaker(activeKey, identity)
    if (identity.source === 'manual' || identity.source === 'contact') {
      void window.electronAPI.invoke('contacts:upsert', {
        displayName: identity.displayName,
        email: identity.email,
      })
      speakersLocalContacts = null
    }
    setQuery(identity.displayName)
    setContactsDismissed(true)
    setLiveContacts([])
  }

  const commitTyped = () => {
    if (!activeKey) return
    const value = query.trim()
    if (!value) return
    const match = mergedCandidates.find(
      (person) =>
        person.displayName.toLowerCase() === value.toLowerCase() ||
        person.email?.toLowerCase() === value.toLowerCase(),
    )
    assign(
      match
        ? {
            displayName: match.displayName,
            email: match.email,
            source: match.source,
          }
        : { displayName: value, source: 'manual' },
    )
  }

  return (
    <div className="speakers-popover" role="dialog" aria-label="Speakers">
      <div className="speakers-popover-header">Speakers</div>
      {speakerKeys.length === 0 ? (
        <p className="meta-popover-empty">No speakers in the transcript yet.</p>
      ) : (
        <ul className="speakers-popover-list">
          {speakerKeys.map((key) => {
            const name = displayNameForSpeaker(key, meeting.speakerIdentities, meeting.speakerLabels)
            const email = emailForSpeaker(key, meeting.speakerIdentities)
            const active = activeKey === key
            const snippet = snippetForSpeaker(entries, key)
            return (
              <li key={key}>
                <div className={`speakers-popover-row${active ? ' is-active' : ''}`}>
                  <SpeakerAvatar label={name} seed={email || name || key} />
                  <div className="speakers-popover-row-main">
                    <div className="speakers-popover-name-line">
                      <button
                        type="button"
                        className="speakers-popover-name"
                        onClick={() => setActiveKey((prev) => (prev === key ? null : key))}
                        aria-expanded={active}
                        title={active ? 'Close rename' : 'Rename speaker'}
                      >
                        {name}
                      </button>
                      {email ? (
                        <>
                          <span className="speakers-popover-dot">·</span>
                          <span className="speakers-popover-email">{email}</span>
                        </>
                      ) : null}
                      {canPlaySpeaker(meeting, entries, key) ? (
                        <button
                          type="button"
                          className="speakers-popover-icon-btn"
                          aria-label={`Play sample of ${name}`}
                          disabled={playing === key}
                          onClick={(event) => {
                            event.stopPropagation()
                            if (playLock.current) return
                            playLock.current = true
                            setPlaying(key)
                            void playSpeakerSnippet(meeting.id, key)
                              .catch(() => false)
                              .finally(() => {
                                playLock.current = false
                                setPlaying(null)
                              })
                          }}
                        >
                          {playing === key ? '…' : '▶'}
                        </button>
                      ) : null}
                    </div>
                    {active ? (
                      <div className="speakers-popover-active-body">
                        <input
                          ref={inputRef}
                          className="speakers-popover-input"
                          value={query}
                          placeholder={`Assign ${key}`}
                          onChange={(event) => {
                            setQuery(event.target.value)
                            setContactsDismissed(false)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              commitTyped()
                            }
                            if (event.key === 'Escape') {
                              event.preventDefault()
                              setActiveKey(null)
                            }
                          }}
                        />
                        {snippet ? <p className="speakers-popover-snippet">{snippet}</p> : null}
                        {!contactsDismissed &&
                        (query.trim() || mergedCandidates.length > 0 || needsReconnect) ? (
                          <div className="speakers-contacts">
                            <div className="speakers-contacts-label">
                              {directoryLoading || searching
                                ? searching
                                  ? 'Searching contacts…'
                                  : 'Loading contacts…'
                                : meeting.attendees?.length || meeting.attendeeEmails?.length
                                  ? 'Participants & contacts'
                                  : 'Contacts'}
                            </div>
                            {needsReconnect ? (
                              <button
                                type="button"
                                className="speakers-reconnect"
                                onClick={() => {
                                  void window.electronAPI.invoke('calendar:open-connect', 'google')
                                }}
                              >
                                Reconnect Google to load Gmail contacts
                              </button>
                            ) : null}
                            <ul className="speakers-contacts-list">
                              {mergedCandidates.map((person) => (
                                <li key={`${person.email ?? person.displayName}`}>
                                  <button
                                    type="button"
                                    className="speakers-contact-row"
                                    onClick={() => {
                                      assign({
                                        displayName: person.displayName,
                                        email: person.email,
                                        source: person.source,
                                      })
                                    }}
                                  >
                                    <SpeakerAvatar
                                      label={person.displayName}
                                      seed={person.email || person.displayName}
                                    />
                                    <span className="speakers-contact-name">{person.displayName}</span>
                                    {person.email ? (
                                      <span className="speakers-contact-email">{person.email}</span>
                                    ) : null}
                                  </button>
                                </li>
                              ))}
                              {query.trim() &&
                              !mergedCandidates.some(
                                (person) =>
                                  person.displayName.toLowerCase() === query.trim().toLowerCase(),
                              ) ? (
                                <li>
                                  <button
                                    type="button"
                                    className="speakers-contact-row is-create"
                                    onClick={() => {
                                      assign({ displayName: query.trim(), source: 'manual' })
                                    }}
                                  >
                                    <span className="speakers-contact-create-icon">+</span>
                                    <span>Create “{query.trim()}”</span>
                                  </button>
                                </li>
                              ) : null}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <button type="button" className="link-btn speakers-popover-done" onClick={onClose}>
        Done
      </button>
    </div>
  )
}

export function MeetingMetaBar({
  meeting,
  folders,
  onSetFolders,
  onCreateFolder,
  allTags,
  onSetTags,
  onAssignSpeaker,
  documentLayout = false,
  transcriptEntries,
}: MeetingMetaBarProps) {
  const [folderOpen, setFolderOpen] = useState(false)
  const [tagOpen, setTagOpen] = useState(false)
  const [speakersOpen, setSpeakersOpen] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)
  const speakersRootRef = useRef<HTMLDivElement>(null)
  const dateRootRef = useRef<HTMLDivElement>(null)
  const selectedFolderIds = meeting.folderIds ?? []
  const selectedTags = meeting.tags ?? []
  const entries = transcriptEntries ?? meeting.transcript
  const speakerKeys = useMemo(() => uniqueTranscriptSpeakers(entries), [entries])
  const namedCount = speakerKeys.filter((key) =>
    isSpeakerIdentified(key, meeting.speakerIdentities, meeting.speakerLabels),
  ).length
  const selectedFolders = folders.filter((folder) => selectedFolderIds.includes(folder.id))
  const pillLabel = speakerPillSummary(
    speakerKeys,
    meeting.speakerIdentities,
    meeting.speakerLabels,
  )
  const previewKeys = speakerKeys.slice(0, 3)

  useEffect(() => {
    if (speakerKeys.length === 0) setSpeakersOpen(false)
  }, [speakerKeys.length])

  useEffect(() => {
    void loadSpeakersContactDirectory()
  }, [])

  useEffect(() => {
    if (!speakersOpen) return
    const onDoc = (event: MouseEvent) => {
      if (!speakersRootRef.current?.contains(event.target as Node)) {
        setSpeakersOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [speakersOpen])

  useEffect(() => {
    if (!dateOpen) return
    const onDoc = (event: MouseEvent) => {
      if (!dateRootRef.current?.contains(event.target as Node)) {
        setDateOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDateOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [dateOpen])

  const speakersControl = (
    <div className="meeting-meta-speakers" ref={speakersRootRef}>
      {speakerKeys.length > 0 ? (
        <button
          type="button"
          className="speakers-pill"
          onClick={() => {
            setSpeakersOpen((v) => !v)
            setFolderOpen(false)
            setTagOpen(false)
            setDateOpen(false)
          }}
          aria-expanded={speakersOpen}
        >
          <span className="speakers-pill-avatars">
            {previewKeys.map((key) => {
              const name = displayNameForSpeaker(
                key,
                meeting.speakerIdentities,
                meeting.speakerLabels,
              )
              const email = emailForSpeaker(key, meeting.speakerIdentities)
              return <SpeakerAvatar key={key} label={name} seed={email || name || key} />
            })}
          </span>
          <span className="speakers-pill-label">{pillLabel}</span>
          <span className="speakers-pill-chevron" aria-hidden>
            ▾
          </span>
        </button>
      ) : (
        <span className="speakers-pill-empty">Listening for speakers…</span>
      )}
      {speakersOpen ? (
        <SpeakersPopover
          meeting={meeting}
          entries={entries}
          speakerKeys={speakerKeys}
          onAssignSpeaker={onAssignSpeaker}
          onClose={() => setSpeakersOpen(false)}
        />
      ) : null}
      {speakerKeys.length > 0 && namedCount < speakerKeys.length ? (
        <span className="speakers-pill-hint">Assign names · play samples to confirm</span>
      ) : null}
    </div>
  )

  if (!documentLayout) {
    return (
      <div className="meeting-meta-bar">
        <span className="meta-pill is-static">{formatMeetingTime(meeting)}</span>
        {speakerKeys.length > 0 ? (
          <div className="meta-pill-wrap meeting-meta-speakers-compact">{speakersControl}</div>
        ) : null}
        <div className="meta-pill-wrap">
        {selectedFolders.map((folder) => (
          <span key={folder.id} className="meeting-folder-chip">
            <span className="meeting-chip-label">{folder.name}</span>
            <button
              type="button"
              className="meeting-chip-remove"
              aria-label={`Remove from folder ${folder.name}`}
              title="Remove from folder"
              onClick={() =>
                onSetFolders(selectedFolderIds.filter((id) => id !== folder.id))
              }
            >
              ×
            </button>
          </span>
        ))}
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

  const attendeeCount = Math.max(
    speakerKeys.length,
    (meeting.attendeeEmails ?? []).filter(Boolean).length,
  )

  return (
    <div className="meeting-meta-bar meeting-meta-bar-doc">
      <div className="meta-pill-wrap" ref={dateRootRef}>
        <button
          type="button"
          className="meta-pill"
          aria-expanded={dateOpen}
          aria-haspopup="dialog"
          onClick={() => {
            setDateOpen((v) => !v)
            setFolderOpen(false)
            setTagOpen(false)
            setSpeakersOpen(false)
          }}
        >
          <svg className="meta-pill-icon" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
            <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          {formatMeetingDateShort(meeting)}
        </button>
        {dateOpen ? (
          <div className="meta-popover meeting-date-popover" role="dialog" aria-label="Meeting time">
            <div className="meeting-date-popover-title">{meeting.title}</div>
            <div className="meeting-date-popover-detail">{formatMeetingDateDetail(meeting)}</div>
          </div>
        ) : null}
      </div>

      <div className="meta-pill-wrap meeting-meta-speakers-compact">
        {speakerKeys.length > 0 ? (
          speakersControl
        ) : (
          <span className="meta-pill is-static">
            <svg className="meta-pill-icon" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="6" cy="6" r="2.2" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="11" cy="6.5" r="1.8" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="M2.5 13c.4-2.2 2-3.4 3.5-3.4S9.1 10.8 9.5 13M9.8 10.2c1.1.2 2.2 1.1 2.7 2.8"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            {attendeeCount > 0 ? `${attendeeCount} attendees` : 'No attendees'}
          </span>
        )}
      </div>

      <div className="meta-pill-wrap">
        {selectedFolders.map((folder) => (
          <span key={folder.id} className="meeting-folder-chip">
            <span className="meeting-chip-label">{folder.name}</span>
            <button
              type="button"
              className="meeting-chip-remove"
              aria-label={`Remove from folder ${folder.name}`}
              title="Remove from folder"
              onClick={() =>
                onSetFolders(selectedFolderIds.filter((id) => id !== folder.id))
              }
            >
              ×
            </button>
          </span>
        ))}
        <button
          type="button"
          className="meta-pill"
          onClick={() => {
            setFolderOpen((v) => !v)
            setTagOpen(false)
            setSpeakersOpen(false)
            setDateOpen(false)
          }}
        >
          <svg className="meta-pill-icon" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M2.5 5.2A1.7 1.7 0 0 1 4.2 3.5h2.1L7.5 5h4.3A1.7 1.7 0 0 1 13.5 6.7v4.6A1.7 1.7 0 0 1 11.8 13H4.2A1.7 1.7 0 0 1 2.5 11.3V5.2Z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
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

      <div className="meta-pill-wrap meeting-meta-tags">
        {selectedTags.map((tag) => (
          <span key={tag} className="meeting-tag-chip">
            <span className="meeting-chip-label">{tag}</span>
            <button
              type="button"
              className="meeting-chip-remove"
              aria-label={`Remove tag ${tag}`}
              title="Remove tag"
              onClick={() =>
                onSetTags(selectedTags.filter((t) => t.toLowerCase() !== tag.toLowerCase()))
              }
            >
              ×
            </button>
          </span>
        ))}
        <button
          type="button"
          className="meta-pill-quiet"
          onClick={() => {
            setTagOpen((v) => !v)
            setFolderOpen(false)
            setSpeakersOpen(false)
            setDateOpen(false)
          }}
        >
          + Tag
        </button>
        <TagPicker
          open={tagOpen}
          allTags={allTags}
          selectedTags={selectedTags}
          onChange={onSetTags}
          onClose={() => setTagOpen(false)}
        />
      </div>
    </div>
  )
}

/** Helper for free-text rename paths (transcript click-to-edit). */
export function assignFromDisplayName(displayName: string): SpeakerIdentity {
  return { displayName, source: 'manual' }
}
