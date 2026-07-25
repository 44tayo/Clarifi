import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useToast } from '../hooks/useToast'
import { StatefulButton } from './ui/StatefulButton'
import type { Meeting } from '../types/meeting'

type ShareNotesPanelProps = {
  meeting: Meeting
  canShare: boolean
  onClose: () => void
  onUpgrade: () => void
  onShareStateChange?: (state: { shareUrl: string | null; communityId: string | null }) => void
  /** Fired when at least one person is invited (not just link published). */
  onInviteSent?: () => void
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
  source: 'contact' | 'manual' | 'participant'
}

type AccessPerson = {
  email: string
  displayName: string
  role: 'owner' | 'viewer'
  inviteSent?: boolean
}

type LinkAccess = 'anyone' | 'invited'

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

export function ShareNotesPanel({
  meeting,
  canShare,
  onClose,
  onUpgrade,
  onShareStateChange,
  onInviteSent,
}: ShareNotesPanelProps) {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [communityId, setCommunityId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<ContactSuggestion[]>([])
  const [people, setPeople] = useState<AccessPerson[]>([
    { email: 'you', displayName: 'You', role: 'owner' },
  ])
  const [linkAccess, setLinkAccess] = useState<LinkAccess>('anyone')
  const [accessMenuOpen, setAccessMenuOpen] = useState(false)
  const { toast } = useToast()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const accessMenuRef = useRef<HTMLDivElement>(null)

  const participants = useMemo(
    () => [...new Set((meeting.attendeeEmails ?? []).map((value) => value.trim()).filter(Boolean))],
    [meeting.attendeeEmails],
  )

  useEffect(() => {
    onShareStateChange?.({ shareUrl, communityId })
  }, [shareUrl, communityId, onShareStateChange])

  useEffect(() => {
    document.body.classList.add('has-modal-open')
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('has-modal-open')
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    if (!accessMenuOpen) return
    const onPointer = (event: MouseEvent) => {
      if (!accessMenuRef.current?.contains(event.target as Node)) setAccessMenuOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    return () => window.removeEventListener('mousedown', onPointer)
  }, [accessMenuOpen])

  useEffect(() => {
    if (!canShare) return
    const q = query.trim()
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const [remote, local] = await Promise.all([
            window.electronAPI.invoke('calendar:contacts-search', { query: q }),
            window.electronAPI.invoke('contacts:list-local'),
          ])
          if (cancelled) return
          const remoteContacts = (
            (remote as { contacts?: Array<{ displayName: string; email?: string }> }).contacts ??
            []
          )
            .filter((person) => person.email?.trim())
            .map((person) => ({
              displayName: person.displayName,
              email: person.email!.trim(),
              source: 'contact' as const,
            }))
          const localContacts = (
            (local as { contacts?: Array<{ displayName: string; email?: string }> }).contacts ?? []
          )
            .filter((person) => person.email?.trim())
            .map((person) => ({
              displayName: person.displayName,
              email: person.email!.trim(),
              source: 'manual' as const,
            }))
          const participantContacts = participants.map((email) => ({
            displayName: email.split('@')[0] || email,
            email,
            source: 'participant' as const,
          }))

          const byEmail = new Map<string, ContactSuggestion>()
          for (const person of [...participantContacts, ...localContacts, ...remoteContacts]) {
            const key = person.email.toLowerCase()
            if (!byEmail.has(key)) byEmail.set(key, person)
          }

          let next = [...byEmail.values()]
          if (q) {
            const needle = q.toLowerCase()
            next = next.filter(
              (person) =>
                person.displayName.toLowerCase().includes(needle) ||
                person.email.toLowerCase().includes(needle),
            )
          }
          if (q && isEmailLike(q) && !next.some((p) => p.email.toLowerCase() === q.toLowerCase())) {
            next = [
              { displayName: q.trim(), email: q.trim(), source: 'manual' },
              ...next,
            ]
          }
          setSuggestions(next.slice(0, 8))
        } catch {
          if (!cancelled) setSuggestions([])
        }
      })()
    }, 120)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [canShare, participants, query])

  async function publish(): Promise<PublishResult> {
    return (await window.electronAPI.invoke('share:publish', {
      meetingId: meeting.id,
    })) as PublishResult
  }

  async function ensurePublished(): Promise<PublishResult> {
    if (shareUrl && communityId) {
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
    async (emailRaw: string, displayName?: string) => {
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
        setPeople((prev) => {
          if (prev.some((p) => p.email.toLowerCase() === email.toLowerCase())) return prev
          return [
            ...prev,
            {
              email,
              displayName: displayName?.trim() || email.split('@')[0] || email,
              role: 'viewer',
              inviteSent: true,
            },
          ]
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
    [shareUrl, communityId, meeting.id, onInviteSent, toast],
  )

  const panel = !canShare ? (
    <div
      className="share-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Share notes"
      onClick={onClose}
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
      className="share-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Share notes"
      onClick={onClose}
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
                    if (first) await inviteEmail(first.email, first.displayName)
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
              if (first) await inviteEmail(first.email, first.displayName)
              else if (isEmailLike(query)) await inviteEmail(query)
              else throw new Error('Enter a valid email address')
              toast('Invite sent')
            }}
          />
        </div>

        {query.trim() && suggestions.length > 0 ? (
          <ul className="share-suggestions" role="listbox">
            {suggestions.map((person) => (
              <li key={`${person.source}-${person.email}`}>
                <button
                  type="button"
                  className="share-suggestion"
                  disabled={busy}
                  onClick={() => {
                    void inviteEmail(person.email, person.displayName).catch((err) => {
                      toast(err instanceof Error ? err.message : 'Could not share notes')
                    })
                  }}
                >
                  <span
                    className="share-person-avatar"
                    style={{ background: avatarColor(person.email) }}
                    aria-hidden
                  >
                    {initialsFor(person.displayName)}
                  </span>
                  <span className="share-suggestion-text">
                    <strong>{person.displayName}</strong>
                    <span>{person.email}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
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
                    if (prev.some((p) => p.email.toLowerCase() === inviteEmailAddr.toLowerCase())) {
                      return prev
                    }
                    return [
                      ...prev,
                      {
                        email: inviteEmailAddr,
                        displayName: inviteEmailAddr.split('@')[0] || inviteEmailAddr,
                        role: 'viewer',
                        inviteSent: true,
                      },
                    ]
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

        <ul className="share-people-list">
          {people.map((person) => (
            <li key={person.email} className="share-person-row">
              <span
                className="share-person-avatar"
                style={{ background: avatarColor(person.email) }}
                aria-hidden
              >
                {initialsFor(person.displayName)}
              </span>
              <span className="share-person-meta">
                <strong>
                  {person.displayName}
                  {person.role === 'owner' ? ' (you)' : ''}
                </strong>
                {person.role !== 'owner' ? <span>{person.email}</span> : null}
                {person.inviteSent ? <span className="share-invite-sent">Invite sent</span> : null}
              </span>
              <span className="share-person-role">
                {person.role === 'owner' ? 'Owner' : 'Viewer'}
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
