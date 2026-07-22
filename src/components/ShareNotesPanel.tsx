import { useMemo, useState } from 'react'

import type { Meeting } from '../types/meeting'

type ShareNotesPanelProps = {
  meeting: Meeting
  canShare: boolean
  onClose: () => void
  onUpgrade: () => void
}

type PublishResult = {
  ok: boolean
  error?: string
  shareUrl?: string
  itemId?: string
  communityId?: string
}

export function ShareNotesPanel({ meeting, canShare, onClose, onUpgrade }: ShareNotesPanelProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [communityId, setCommunityId] = useState<string | null>(null)

  const participants = useMemo(
    () => [...new Set((meeting.attendeeEmails ?? []).map((value) => value.trim()).filter(Boolean))],
    [meeting.attendeeEmails],
  )

  if (!canShare) {
    return (
      <div className="share-overlay" role="dialog" aria-modal="true" aria-label="Share notes">
        <div className="share-panel">
          <div className="share-panel-header">
            <h2>Share notes</h2>
            <button type="button" className="link-btn" onClick={onClose}>
              Close
            </button>
          </div>
          <p className="share-upgrade-copy">
            Sharing meetings, notes, and summaries is included with Pro+. Upgrade to publish a link
            and invite people by email.
          </p>
          <button type="button" className="btn btn-primary" onClick={onUpgrade}>
            Upgrade to Pro+
          </button>
        </div>
      </div>
    )
  }

  async function publish(): Promise<PublishResult> {
    return (await window.electronAPI.invoke('share:publish', { meetingId: meeting.id })) as PublishResult
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

  return (
    <div className="share-overlay" role="dialog" aria-modal="true" aria-label="Share notes">
      <div className="share-panel">
        <div className="share-panel-header">
          <h2>Share notes</h2>
          <button type="button" className="link-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <label className="settings-field">
          <span>Invite by email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Search people or emails"
          />
        </label>

        {participants.length > 0 ? (
          <button
            type="button"
            className="link-btn"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true)
                setStatus(null)
                const published = await ensurePublished()
                if (!published.ok || !published.communityId) {
                  setStatus(published.error ?? 'Could not publish notes')
                  setBusy(false)
                  return
                }
                for (const inviteEmail of participants) {
                  await window.electronAPI.invoke('share:invite', {
                    communityId: published.communityId,
                    email: inviteEmail,
                  })
                }
                setStatus(`Invited ${participants.length} participant${participants.length === 1 ? '' : 's'}`)
                setBusy(false)
              })()
            }}
          >
            + All participants
          </button>
        ) : null}

        <div className="share-owner-row">
          <span>You</span>
          <span className="share-owner-badge">Owner</span>
        </div>

        <div className="share-link-row">
          <span>Anyone with the link</span>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true)
                setStatus(null)
                const published = await ensurePublished()
                if (!published.ok || !published.shareUrl) {
                  setStatus(published.error ?? 'Could not create share link')
                  setBusy(false)
                  return
                }
                await navigator.clipboard.writeText(published.shareUrl)
                setStatus('Link copied')
                setBusy(false)
              })()
            }}
          >
            Copy link
          </button>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !email.trim()}
          onClick={() => {
            void (async () => {
              setBusy(true)
              setStatus(null)
              const published = await ensurePublished()
              if (!published.ok || !published.communityId) {
                setStatus(published.error ?? 'Could not publish notes')
                setBusy(false)
                return
              }
              const invite = (await window.electronAPI.invoke('share:invite', {
                communityId: published.communityId,
                email: email.trim(),
              })) as { ok: boolean; error?: string }
              setStatus(invite.ok ? `Invite sent to ${email.trim()}` : invite.error ?? 'Invite failed')
              if (invite.ok) setEmail('')
              setBusy(false)
            })()
          }}
        >
          Send invite
        </button>

        {status ? <p className="share-status" role="status">{status}</p> : null}
        {shareUrl ? <p className="share-url">{shareUrl}</p> : null}
      </div>
    </div>
  )
}
