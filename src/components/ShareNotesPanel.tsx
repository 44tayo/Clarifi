import { useCallback, useEffect, useMemo, useRef, useState, type TransitionEvent } from 'react'
import { createPortal } from 'react-dom'

import { useToast } from '../hooks/useToast'
import { StatefulButton } from './ui/StatefulButton'
import type { Meeting } from '../types/meeting'

type ShareNotesPanelProps = {
  meeting: Meeting
  canShare: boolean
  onClose: () => void
  onUpgrade: () => void
  ownerEmail?: string | null
  onShareStateChange?: (state: { shareUrl: string | null; communityId: string | null }) => void
  /** Fired when at least one person is invited (not just link published). */
  onInviteSent?: () => void
  /** When false, plays exit animation then calls onExited. Defaults to true. */
  open?: boolean
  onExited?: () => void
}

type PublishResult = {
  ok: boolean
  error?: string
  shareUrl?: string
  itemId?: string
  communityId?: string
}

type ContactSuggestion = {
  displayName: string
  email: string
  photoUrl?: string
  source: 'contact' | 'manual' | 'participant'
}

type AccessPerson = {
  email: string
  displayName: string
  photoUrl?: string
  role: 'owner' | 'viewer' | 'participant'
  inviteSent?: boolean
}

type LinkAccess = 'anyone' | 'invited'

/** Survives Share panel unmount so reopen can paint names/PFPs immediately. */
let cachedDirectoryContacts: ContactSuggestion[] = []
const cachedAccessPeopleByMeeting = new Map<string, AccessPerson[]>()

function rememberDirectory(contacts: ContactSuggestion[]) {
  cachedDirectoryContacts = contacts
}

function resolveDirectory(live: ContactSuggestion[]): ContactSuggestion[] {
  return live.length > 0 ? live : cachedDirectoryContacts
}

function rememberAccessPeople(meetingId: string, people: AccessPerson[]) {
  cachedAccessPeopleByMeeting.set(meetingId, people)
}

function shareErrorMessage(code?: string): string {
  switch (code) {
    case 'network_error':
      return 'You appear offline. Try again when you reconnect.'
    case 'not_authenticated':
    case 'auth_expired':
      return 'Connect your account to share notes.'
    case 'plan_required':
      return 'Sharing requires Pro+. Upgrade to publish a link and invite people.'
    case 'meeting_not_found':
      return 'Meeting not found.'
    case 'storage_unavailable':
    case 'share_failed':
      return 'Could not publish share link. Please try again in a moment.'
    case 'share_not_found':
      return 'Publish the share link first, then invite people.'
    case 'invalid_email':
      return 'Enter a valid email address.'
    case 'email_not_configured':
      return 'Email delivery is not configured. Add RESEND_API_KEY to send invites automatically.'
    case 'email_delivery_failed':
      return 'Could not send the invite email. Check the address and try again.'
    case 'invite_failed':
      return 'Could not send the invite email. Please try again.'
    default:
      return code?.trim() || 'Something went wrong.'
  }
}

function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

function avatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  const hues = [210, 195, 160, 25, 340, 280]
  const hue = hues[hash % hues.length]
  return `hsl(${hue} 42% 46%)`
}

function ContactAvatar({
  name,
  email,
  photoUrl,
}: {
  name: string
  email: string
  photoUrl?: string
}) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const trimmedPhoto = photoUrl?.trim() || ''

  useEffect(() => {
    setPhotoFailed(false)
  }, [trimmedPhoto])

  const showPhoto = Boolean(trimmedPhoto) && !photoFailed

  if (showPhoto) {
    return (
      <img
        key={trimmedPhoto}
        className="share-person-avatar share-person-avatar-photo"
        src={trimmedPhoto}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setPhotoFailed(true)}
      />
    )
  }
  return (
    <span
      className="share-person-avatar"
      style={{ background: avatarColor(email) }}
      aria-hidden
    >
      {initialsFor(name)}
    </span>
  )
}

const OWNER_ONLY: AccessPerson[] = [{ email: 'you', displayName: 'You', role: 'owner' }]

function filterContactSuggestions(
  contacts: ContactSuggestion[],
  query: string,
): ContactSuggestion[] {
  const q = query.trim().toLowerCase()
  if (!q) return contacts.slice(0, 20)
  return contacts
    .filter((person) => {
      const name = person.displayName.toLowerCase()
      const email = person.email.toLowerCase()
      const local = email.split('@')[0] ?? ''
      return name.includes(q) || email.includes(q) || local.includes(q)
    })
    .slice(0, 20)
}

function contactLookup(
  directory: ContactSuggestion[],
  email: string,
): { displayName?: string; photoUrl?: string } {
  const key = email.trim().toLowerCase()
  const match = directory.find((person) => person.email.toLowerCase() === key)
  if (!match) return {}
  return {
    displayName: match.displayName?.trim() || undefined,
    photoUrl: match.photoUrl?.trim() || undefined,
  }
}

function enrichAccessPeople(
  people: AccessPerson[],
  directory: ContactSuggestion[],
): AccessPerson[] {
  if (directory.length === 0) return people
  let changed = false
  const next = people.map((person) => {
    if (person.role === 'owner') return person
    const hit = contactLookup(directory, person.email)
    if (!hit.displayName && !hit.photoUrl) return person
    const displayName =
      hit.displayName &&
      (person.displayName === person.email.split('@')[0] || !person.displayName.trim())
        ? hit.displayName
        : person.displayName
    const photoUrl = person.photoUrl || hit.photoUrl
    if (displayName === person.displayName && photoUrl === person.photoUrl) return person
    changed = true
    return { ...person, displayName, photoUrl }
  })
  return changed ? next : people
}

export function ShareNotesPanel({
  meeting,
  canShare,
  onClose,
  onUpgrade,
  ownerEmail,
  onShareStateChange,
  onInviteSent,
  open = true,
  onExited,
}: ShareNotesPanelProps) {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [communityId, setCommunityId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<ContactSuggestion[]>([])
  const [directoryContacts, setDirectoryContacts] = useState<ContactSuggestion[]>(
    () => cachedDirectoryContacts,
  )
  const [contactsSearching, setContactsSearching] = useState(false)
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [people, setPeople] = useState<AccessPerson[]>(() => {
    const cached = cachedAccessPeopleByMeeting.get(meeting.id)
    return cached && cached.length > 0 ? cached : OWNER_ONLY
  })
  const [linkAccess, setLinkAccess] = useState<LinkAccess>('anyone')
  const [accessMenuOpen, setAccessMenuOpen] = useState(false)
  const [accessReady, setAccessReady] = useState(
    () => (cachedAccessPeopleByMeeting.get(meeting.id)?.length ?? 0) > 1,
  )
  const [entered, setEntered] = useState(false)
  const { toast } = useToast()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const onExitedRef = useRef(onExited)
  onExitedRef.current = onExited
  const accessMenuRef = useRef<HTMLDivElement>(null)
  const exitedRef = useRef(false)
  const directoryRef = useRef(directoryContacts)
  directoryRef.current = directoryContacts
  /** Access mode actually confirmed on the server for the current shareUrl,
   * so switching the toggle after a link is already published always
   * triggers a real re-sync instead of silently returning a stale cache. */
  const publishedAccessRef = useRef<LinkAccess | null>(null)

  const resetShareUi = useCallback(() => {
    setQuery('')
    setSuggestions([])
    setShareUrl(null)
    setCommunityId(null)
    setLinkAccess('anyone')
    setAccessMenuOpen(false)
    setBusy(false)
    publishedAccessRef.current = null
    const cachedPeople = cachedAccessPeopleByMeeting.get(meeting.id)
    if (cachedPeople && cachedPeople.length > 0) {
      setPeople(cachedPeople)
      setAccessReady(true)
    } else {
      setPeople(OWNER_ONLY)
      setAccessReady(false)
    }
    if (cachedDirectoryContacts.length > 0) {
      setDirectoryContacts(cachedDirectoryContacts)
    }
  }, [meeting.id])

  const participants = useMemo(() => {
    const fromEmails = (meeting.attendeeEmails ?? []).map((value) => value.trim()).filter(Boolean)
    const fromAttendees = (meeting.attendees ?? [])
      .map((person) => person.email?.trim() || '')
      .filter(Boolean)
    return [...new Set([...fromEmails, ...fromAttendees])]
  }, [meeting.attendeeEmails, meeting.attendees])

  useEffect(() => {
    onShareStateChange?.({ shareUrl, communityId })
  }, [shareUrl, communityId, onShareStateChange])

  // Enter / exit motion + hard reset on open so prior invitees never flash.
  useEffect(() => {
    if (!open) {
      setEntered(false)
      return
    }
    exitedRef.current = false
    resetShareUi()
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setEntered(true))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, meeting.id, resetShareUi])

  useEffect(() => {
    if (open) return
    const finish = () => {
      if (exitedRef.current) return
      exitedRef.current = true
      onExitedRef.current?.()
    }
    const timer = window.setTimeout(finish, 280)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!canShare || !open) return
    let cancelled = false
    // Keep cached people visible; only fall back to owner-only when we have nothing.
    if (!cachedAccessPeopleByMeeting.get(meeting.id)) {
      setAccessReady(false)
      setPeople(OWNER_ONLY)
    }
    void (async () => {
      const access = (await window.electronAPI.invoke('share:access', {
        meetingId: meeting.id,
      })) as {
        ok?: boolean
        shareUrl?: string | null
        communityId?: string | null
        linkAccess?: LinkAccess
        invitedEmails?: string[]
      }
      if (cancelled) return

      const invited = (access.invitedEmails ?? [])
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
      const invitedSet = new Set(invited)

      if (access.ok) {
        if (access.shareUrl) setShareUrl(access.shareUrl)
        if (access.communityId) setCommunityId(access.communityId)
        if (access.linkAccess === 'anyone' || access.linkAccess === 'invited') {
          setLinkAccess(access.linkAccess)
          if (access.shareUrl) publishedAccessRef.current = access.linkAccess
        }
      }

      const nextPeople: AccessPerson[] = [...OWNER_ONLY]
      for (const email of invited) {
        nextPeople.push({
          email,
          displayName: email.split('@')[0] || email,
          role: 'viewer',
          inviteSent: true,
        })
      }
      for (const email of participants) {
        const key = email.toLowerCase()
        if (invitedSet.has(key)) continue
        nextPeople.push({
          email,
          displayName: email.split('@')[0] || email,
          role: 'participant',
        })
      }
      const enriched = enrichAccessPeople(nextPeople, resolveDirectory(directoryRef.current))
      rememberAccessPeople(meeting.id, enriched)
      setPeople(enriched)
      setAccessReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [canShare, open, meeting.id, participants])

  // Directory may load after access list — backfill names/photos.
  useEffect(() => {
    if (!accessReady || directoryContacts.length === 0) return
    setPeople((prev) => {
      const next = enrichAccessPeople(prev, directoryContacts)
      if (next !== prev) rememberAccessPeople(meeting.id, next)
      return next
    })
  }, [directoryContacts, accessReady, meeting.id])

  useEffect(() => {
    if (!open) return
    document.body.classList.add('has-modal-open')
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('has-modal-open')
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!accessMenuOpen) return
    const onPointer = (event: MouseEvent) => {
      if (!accessMenuRef.current?.contains(event.target as Node)) setAccessMenuOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    return () => window.removeEventListener('mousedown', onPointer)
  }, [accessMenuOpen])

  const overlayClass = `share-overlay${entered && open ? ' is-open' : ''}`
  const finishExitIfNeeded = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (open || exitedRef.current) return
    exitedRef.current = true
    onExitedRef.current?.()
  }

  // Prefetch full Gmail/local directory once so each keystroke filters instantly.
  // Soft refresh — do not invalidate on every open (warm cache keeps names/PFPs instant).
  useEffect(() => {
    if (!canShare) return
    let cancelled = false
    if (cachedDirectoryContacts.length > 0) {
      setDirectoryContacts(cachedDirectoryContacts)
    }
    void (async () => {
      try {
        const [remote, local] = await Promise.all([
          window.electronAPI.invoke('calendar:contacts-search', { query: '' }),
          window.electronAPI.invoke('contacts:list-local'),
        ])
        if (cancelled) return
        const remotePayload = remote as {
          contacts?: Array<{ displayName: string; email?: string; photoUrl?: string }>
          needsReconnect?: boolean
          connected?: boolean
        }
        if (remotePayload.needsReconnect) setNeedsReconnect(true)
        else if ((remotePayload.contacts?.length ?? 0) > 0) setNeedsReconnect(false)
        else if (remotePayload.connected) setNeedsReconnect(true)

        const remoteContacts = (remotePayload.contacts ?? [])
          .filter((person) => person.email?.trim())
          .map((person) => ({
            displayName: person.displayName,
            email: person.email!.trim(),
            photoUrl: person.photoUrl?.trim() || undefined,
            source: 'contact' as const,
          }))
        if (remoteContacts.length === 0 && remotePayload.connected) {
          setNeedsReconnect(true)
        }
        const localContacts = (
          (local as { contacts?: Array<{ displayName: string; email?: string }> }).contacts ?? []
        )
          .filter((person) => person.email?.trim())
          .map((person) => ({
            displayName: person.displayName,
            email: person.email!.trim(),
            photoUrl: undefined as string | undefined,
            source: 'manual' as const,
          }))
        const participantContacts = participants.map((email) => ({
          displayName: email.split('@')[0] || email,
          email,
          photoUrl: undefined as string | undefined,
          source: 'participant' as const,
        }))

        const byEmail = new Map<string, ContactSuggestion>()
        for (const person of [...participantContacts, ...localContacts, ...remoteContacts]) {
          const key = person.email.toLowerCase()
          const existing = byEmail.get(key)
          if (!existing) {
            byEmail.set(key, person)
            continue
          }
          if (!existing.photoUrl && person.photoUrl) existing.photoUrl = person.photoUrl
          if (
            existing.displayName === existing.email.split('@')[0] &&
            person.displayName &&
            person.displayName !== person.email.split('@')[0]
          ) {
            existing.displayName = person.displayName
          }
        }
        const merged = [...byEmail.values()]
        rememberDirectory(merged)
        setDirectoryContacts(merged)
      } catch {
        if (!cancelled && cachedDirectoryContacts.length === 0) setDirectoryContacts([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canShare, participants])

  // Letter-by-letter: filter the prefetched directory immediately, then enrich with live search.
  useEffect(() => {
    if (!canShare) return
    const q = query.trim()
    const participantContacts = participants.map((email) => ({
      displayName: email.split('@')[0] || email,
      email,
      source: 'participant' as const,
    }))
    const base = [...directoryContacts]
    for (const person of participantContacts) {
      if (!base.some((item) => item.email.toLowerCase() === person.email.toLowerCase())) {
        base.push(person)
      }
    }

    let next = filterContactSuggestions(base, q)
    if (q && isEmailLike(q) && !next.some((p) => p.email.toLowerCase() === q.toLowerCase())) {
      next = [{ displayName: q, email: q, source: 'manual' }, ...next]
    }
    setSuggestions(next)

    if (!q) {
      setContactsSearching(false)
      return
    }

    let cancelled = false
    setContactsSearching(true)
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const remote = (await window.electronAPI.invoke('calendar:contacts-search', {
            query: q,
          })) as {
            contacts?: Array<{ displayName: string; email?: string; photoUrl?: string }>
            needsReconnect?: boolean
          }
          if (cancelled) return
          if (remote.needsReconnect) setNeedsReconnect(true)
          else if ((remote.contacts?.length ?? 0) > 0) setNeedsReconnect(false)

          const live = (remote.contacts ?? [])
            .filter((person) => person.email?.trim())
            .map((person) => ({
              displayName: person.displayName,
              email: person.email!.trim(),
              photoUrl: person.photoUrl?.trim() || undefined,
              source: 'contact' as const,
            }))

          if (live.length === 0) {
            setContactsSearching(false)
            return
          }

          const byEmail = new Map<string, ContactSuggestion>()
          for (const person of [...next, ...live]) {
            const key = person.email.toLowerCase()
            const existing = byEmail.get(key)
            if (!existing) {
              byEmail.set(key, person)
              continue
            }
            if (!existing.photoUrl && person.photoUrl) existing.photoUrl = person.photoUrl
          }
          let merged = filterContactSuggestions([...byEmail.values()], q)
          if (isEmailLike(q) && !merged.some((p) => p.email.toLowerCase() === q.toLowerCase())) {
            merged = [{ displayName: q, email: q, source: 'manual' }, ...merged]
          }
          setSuggestions(merged.slice(0, 20))
          // Keep directory warm with any new live hits.
          setDirectoryContacts((prev) => {
            const map = new Map(prev.map((person) => [person.email.toLowerCase(), person]))
            for (const person of live) {
              const key = person.email.toLowerCase()
              const existing = map.get(key)
              if (!existing) map.set(key, person)
              else if (!existing.photoUrl && person.photoUrl) existing.photoUrl = person.photoUrl
            }
            return [...map.values()]
          })
        } catch {
          // Keep local filtered suggestions.
        } finally {
          if (!cancelled) setContactsSearching(false)
        }
      })()
    }, 100)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [canShare, participants, query, directoryContacts])

  async function publish(): Promise<PublishResult> {
    const result = (await window.electronAPI.invoke('share:publish', {
      meetingId: meeting.id,
      linkAccess,
    })) as PublishResult
    if (result.ok) publishedAccessRef.current = linkAccess
    return result
  }

  async function ensurePublished(): Promise<PublishResult> {
    if (shareUrl && communityId && publishedAccessRef.current === linkAccess) {
      return { ok: true, shareUrl, communityId }
    }
    const result = await publish()
    if (result.ok && result.shareUrl) {
      setShareUrl(result.shareUrl)
      setCommunityId(result.communityId ?? null)
    }
    return result
  }

  const inviteEmail = useCallback(
    async (emailRaw: string, displayName?: string, photoUrl?: string) => {
      const email = emailRaw.trim()
      if (!email || !isEmailLike(email)) {
        throw new Error('Enter a valid email address')
      }
      setBusy(true)
      try {
        const published = await ensurePublished()
        if (!published.ok || !published.communityId) {
          throw new Error(shareErrorMessage(published.error))
        }
        const invite = (await window.electronAPI.invoke('share:invite', {
          communityId: published.communityId,
          email,
          meetingId: meeting.id,
        })) as { ok: boolean; error?: string; delivery?: 'resend' | 'compose' }
        if (!invite.ok) {
          throw new Error(shareErrorMessage(invite.error))
        }
        const hit = contactLookup(resolveDirectory(directoryContacts), email)
        setPeople((prev) => {
          const directory = resolveDirectory(directoryContacts)
          let next: AccessPerson[]
          if (prev.some((p) => p.email.toLowerCase() === email.toLowerCase())) {
            next = enrichAccessPeople(prev, directory)
          } else {
            next = [
              ...prev,
              {
                email,
                displayName:
                  displayName?.trim() || hit.displayName || email.split('@')[0] || email,
                photoUrl: photoUrl?.trim() || hit.photoUrl,
                role: 'viewer',
                inviteSent: true,
              },
            ]
          }
          rememberAccessPeople(meeting.id, next)
          return next
        })
        void window.electronAPI.invoke('contacts:upsert', {
          displayName: displayName?.trim() || email.split('@')[0] || email,
          email,
        })
        setQuery('')
        onInviteSent?.()
        toast(
          invite.delivery === 'compose'
            ? 'Opened your mail app — click Send to deliver the invite'
            : `Invite sent to ${email}`,
        )
      } finally {
        setBusy(false)
      }
    },
    // ensurePublished closes over shareUrl/communityId — intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shareUrl, communityId, meeting.id, onInviteSent, toast, directoryContacts],
  )

  const panel = !canShare ? (
    <div
      className={overlayClass}
      role="dialog"
      aria-modal="true"
      aria-label="Share notes"
      onClick={onClose}
      onTransitionEnd={finishExitIfNeeded}
    >
      <div className="share-panel" onClick={(event) => event.stopPropagation()}>
        <div className="share-panel-header">
          <h2>Share notes</h2>
          <button type="button" className="share-close-btn" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        <p className="share-upgrade-copy">
          Sharing meetings, notes, and summaries is included with Pro+. Upgrade to publish a link and
          invite people by email.
        </p>
        <button type="button" className="btn btn-primary" onClick={onUpgrade}>
          Upgrade to Pro+
        </button>
      </div>
    </div>
  ) : (
    <div
      className={overlayClass}
      role="dialog"
      aria-modal="true"
      aria-label="Share notes"
      onClick={onClose}
      onTransitionEnd={finishExitIfNeeded}
    >
      <div className="share-panel share-panel-granola" onClick={(event) => event.stopPropagation()}>
        <div className="share-panel-header">
          <h2>Share notes</h2>
          <button type="button" className="share-close-btn" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>

        <div className="share-search-row">
          <input
            type="text"
            className="share-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people or emails"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                const first = suggestions[0]
                void (async () => {
                  try {
                    if (first) await inviteEmail(first.email, first.displayName, first.photoUrl)
                    else if (isEmailLike(query)) await inviteEmail(query)
                  } catch (err) {
                    toast(err instanceof Error ? err.message : 'Could not share notes')
                  }
                })()
              }
            }}
          />
          <StatefulButton
            variant="primary"
            idleLabel="Share"
            successLabel="Sent"
            loadingLabel="Sharing…"
            className="share-send-btn"
            disabled={busy || (!suggestions[0] && !isEmailLike(query))}
            onClick={async () => {
              const first = suggestions[0]
              if (first) await inviteEmail(first.email, first.displayName, first.photoUrl)
              else if (isEmailLike(query)) await inviteEmail(query)
              else throw new Error('Enter a valid email address')
              toast('Invite sent')
            }}
          />
        </div>

        {needsReconnect ? (
          <button
            type="button"
            className="share-reconnect"
            onClick={() => {
              void window.electronAPI.invoke('calendar:contacts-invalidate')
              void window.electronAPI.invoke('calendar:open-connect', 'google')
            }}
          >
            Reconnect Google to load Gmail contacts
          </button>
        ) : null}

        {query.trim() && suggestions.length > 0 ? (
          <ul className="share-suggestions" role="listbox">
            {suggestions.map((person) => (
              <li key={`${person.source}-${person.email}`}>
                <button
                  type="button"
                  className="share-suggestion"
                  disabled={busy}
                  onClick={() => {
                    void inviteEmail(person.email, person.displayName, person.photoUrl).catch((err) => {
                      toast(err instanceof Error ? err.message : 'Could not share notes', {
                        type: 'error',
                      })
                    })
                  }}
                >
                  <ContactAvatar
                    name={person.displayName}
                    email={person.email}
                    photoUrl={person.photoUrl}
                  />
                  <span className="share-suggestion-text">
                    <strong>{person.displayName}</strong>
                    <span>{person.email}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {query.trim() && !contactsSearching && suggestions.length === 0 && !needsReconnect ? (
          <p className="share-contacts-empty">
            No contacts match “{query.trim()}”. Try another name or paste their email.
          </p>
        ) : null}

        {query.trim() && contactsSearching && suggestions.length === 0 ? (
          <p className="share-contacts-empty">Searching contacts…</p>
        ) : null}

        {participants.length > 0 ? (
          <StatefulButton
            variant="link"
            idleLabel="+ All participants"
            successLabel="Invited"
            loadingLabel="Inviting…"
            className="share-all-participants"
            disabled={busy}
            onClick={async () => {
              const published = await ensurePublished()
              if (!published.ok || !published.communityId) {
                throw new Error(shareErrorMessage(published.error))
              }
              let invited = 0
              for (const inviteEmailAddr of participants) {
                const invite = (await window.electronAPI.invoke('share:invite', {
                  communityId: published.communityId,
                  email: inviteEmailAddr,
                  meetingId: meeting.id,
                })) as { ok: boolean }
                if (invite.ok) {
                  invited += 1
                  setPeople((prev) => {
                    const directory = resolveDirectory(directoryContacts)
                    let next: AccessPerson[]
                    if (prev.some((p) => p.email.toLowerCase() === inviteEmailAddr.toLowerCase())) {
                      next = enrichAccessPeople(prev, directory)
                    } else {
                      const hit = contactLookup(directory, inviteEmailAddr)
                      next = [
                        ...prev,
                        {
                          email: inviteEmailAddr,
                          displayName:
                            hit.displayName || inviteEmailAddr.split('@')[0] || inviteEmailAddr,
                          photoUrl: hit.photoUrl,
                          role: 'viewer',
                          inviteSent: true,
                        },
                      ]
                    }
                    rememberAccessPeople(meeting.id, next)
                    return next
                  })
                }
              }
              if (invited === 0) {
                throw new Error('Could not invite participants')
              }
              onInviteSent?.()
              toast(
                `Invited ${invited} participant${invited === 1 ? '' : 's'}`,
              )
            }}
          />
        ) : null}

        <p className="share-people-label">People with access</p>
        <ul className="share-people-list">
          {people.map((person) => (
            <li key={person.email} className="share-person-row">
              <ContactAvatar
                name={person.displayName}
                email={person.email}
                photoUrl={person.photoUrl}
              />
              <span className="share-person-meta">
                <strong>
                  {person.displayName}
                  {person.role === 'owner' && ownerEmail?.trim()
                    ? ` (${ownerEmail.trim()})`
                    : ''}
                </strong>
                {person.role !== 'owner' ? <span>{person.email}</span> : null}
                {person.inviteSent ? <span className="share-invite-sent">Invite sent</span> : null}
              </span>
              <span className="share-person-role">
                {person.role === 'owner'
                  ? 'Owner'
                  : person.role === 'participant'
                    ? 'Participant'
                    : 'Viewer'}
              </span>
            </li>
          ))}
        </ul>

        <div className="share-link-footer">
          <div className="share-access-menu" ref={accessMenuRef}>
            <button
              type="button"
              className="share-access-trigger"
              onClick={() => setAccessMenuOpen((open) => !open)}
              aria-expanded={accessMenuOpen}
            >
              <span className="share-access-icon" aria-hidden>
                {linkAccess === 'anyone' ? (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
                    <path
                      d="M2.5 8h11M8 2.5c1.8 1.8 2.7 3.6 2.7 5.5S9.8 11.7 8 13.5C6.2 11.7 5.3 9.9 5.3 8S6.2 4.3 8 2.5Z"
                      stroke="currentColor"
                      strokeWidth="1.3"
                    />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <rect
                      x="3.5"
                      y="7"
                      width="9"
                      height="6.5"
                      rx="1.2"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <path
                      d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </span>
              <span>
                {linkAccess === 'anyone' ? 'Anyone with the link' : 'Only people invited'}
              </span>
              <span aria-hidden>▾</span>
            </button>
            {accessMenuOpen ? (
              <div className="share-access-popover" role="listbox">
                <button
                  type="button"
                  className={`share-access-option${linkAccess === 'anyone' ? ' is-selected' : ''}`}
                  role="option"
                  aria-selected={linkAccess === 'anyone'}
                  onClick={() => {
                    setLinkAccess('anyone')
                    setAccessMenuOpen(false)
                    void ensurePublished()
                  }}
                >
                  <span aria-hidden>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
                      <path
                        d="M2.5 8h11M8 2.5c1.8 1.8 2.7 3.6 2.7 5.5S9.8 11.7 8 13.5C6.2 11.7 5.3 9.9 5.3 8S6.2 4.3 8 2.5Z"
                        stroke="currentColor"
                        strokeWidth="1.3"
                      />
                    </svg>
                  </span>
                  <span>
                    <strong>Anyone with the link</strong>
                    <em>Publish a shareable link</em>
                  </span>
                  {linkAccess === 'anyone' ? <span aria-hidden>✓</span> : null}
                </button>
                <button
                  type="button"
                  className={`share-access-option${linkAccess === 'invited' ? ' is-selected' : ''}`}
                  role="option"
                  aria-selected={linkAccess === 'invited'}
                  onClick={() => {
                    setLinkAccess('invited')
                    setAccessMenuOpen(false)
                    // Re-syncs server-side if a link was already published,
                    // matching the "anyone" branch above.
                    if (shareUrl) void ensurePublished()
                  }}
                >
                  <span aria-hidden>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <rect
                        x="3.5"
                        y="7"
                        width="9"
                        height="6.5"
                        rx="1.2"
                        stroke="currentColor"
                        strokeWidth="1.4"
                      />
                      <path
                        d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span>
                    <strong>Only people invited</strong>
                    <em>Invite by email to grant access</em>
                  </span>
                  {linkAccess === 'invited' ? <span aria-hidden>✓</span> : null}
                </button>
              </div>
            ) : null}
          </div>

          <StatefulButton
            variant="secondary"
            idleLabel="Copy link"
            successLabel="Copied"
            successDuration={1600}
            className="share-copy-link"
            disabled={busy || (linkAccess === 'invited' && !shareUrl && people.length <= 1)}
            icon={
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l1.8-1.8a2.6 2.6 0 1 0-3.7-3.7L7.8 4.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M9.2 6.8a2.6 2.6 0 0 0-3.7 0L3.7 8.6a2.6 2.6 0 1 0 3.7 3.7l.8-.8"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            }
            onClick={async () => {
              const published = await ensurePublished()
              if (!published.ok || !published.shareUrl) {
                throw new Error(shareErrorMessage(published.error))
              }
              await navigator.clipboard.writeText(published.shareUrl)
              toast(
                linkAccess === 'invited'
                  ? 'Link copied — share with invited people'
                  : 'Link copied',
              )
            }}
          />
        </div>
      </div>
    </div>
  )

  return createPortal(panel, document.body)
}

/** Publish-if-needed and copy share URL — used by header link button. */
export async function copyMeetingShareLink(meetingId: string): Promise<{
  ok: boolean
  shareUrl?: string
  communityId?: string
  error?: string
}> {
  const result = (await window.electronAPI.invoke('share:publish', { meetingId })) as PublishResult
  if (!result.ok || !result.shareUrl) {
    return { ok: false, error: result.error }
  }
  await navigator.clipboard.writeText(result.shareUrl)
  return {
    ok: true,
    shareUrl: result.shareUrl,
    communityId: result.communityId,
  }
}
