import { useCallback, useEffect, useState } from 'react'

import { useToast } from '../hooks/useToast'
import { StatefulButton } from './ui/StatefulButton'

type SharedInboxInvite = {
  kind: 'invite'
  id: string
  communityId: string
  communityName: string
  token: string
  expiresAt: string
}

type SharedInboxItem = {
  kind: 'item'
  id: string
  communityId: string
  communityName: string
  title: string
  type: string
  sharedBy: string
  sharedByLabel: string
  createdAt: string
  preview: string | null
}

type SharedInboxEntry = SharedInboxInvite | SharedInboxItem

type SharedItemDetail = {
  id: string
  communityId: string
  communityName: string
  title: string
  content: unknown
  sharedByLabel: string
  createdAt: string
}

type SharedWithMeViewProps = {
  paired: boolean
  onConnect: () => void
  onOpenDashboard: () => void
}

function formatWhen(iso: string): string {
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return ''
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(at))
}

function contentFields(content: unknown): {
  summary?: string
  enhancedNotes?: string
  userNotes?: string
  actionItems?: string[]
  transcript?: Array<{ speaker: string; text: string }>
} {
  if (!content || typeof content !== 'object') return {}
  const c = content as Record<string, unknown>
  return {
    summary: typeof c.summary === 'string' ? c.summary : undefined,
    enhancedNotes: typeof c.enhancedNotes === 'string' ? c.enhancedNotes : undefined,
    userNotes: typeof c.userNotes === 'string' ? c.userNotes : undefined,
    actionItems: Array.isArray(c.actionItems)
      ? c.actionItems.filter((x): x is string => typeof x === 'string')
      : undefined,
    transcript: Array.isArray(c.transcript)
      ? c.transcript
          .filter(
            (row): row is { speaker: string; text: string } =>
              Boolean(row) &&
              typeof row === 'object' &&
              typeof (row as { speaker?: unknown }).speaker === 'string' &&
              typeof (row as { text?: unknown }).text === 'string',
          )
          .map((row) => ({ speaker: row.speaker, text: row.text }))
      : undefined,
  }
}

export function SharedWithMeView({
  paired,
  onConnect,
  onOpenDashboard,
}: SharedWithMeViewProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [planRequired, setPlanRequired] = useState(false)
  const [entries, setEntries] = useState<SharedInboxEntry[]>([])
  const [selected, setSelected] = useState<SharedItemDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const { toast } = useToast()

  const refresh = useCallback(async () => {
    if (!paired) {
      setLoading(false)
      setEntries([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = (await window.electronAPI.invoke('share:list-shared')) as {
        ok?: boolean
        error?: string
        planRequired?: boolean
        entries?: SharedInboxEntry[]
      }
      if (!result.ok) {
        if (result.error === 'not_authenticated') {
          setError('Connect your account to see shared notes.')
        } else if (result.error === 'network_error') {
          setError('You appear to be offline.')
        } else {
          setError('Could not load shared notes.')
        }
        setEntries([])
        return
      }
      setPlanRequired(Boolean(result.planRequired))
      setEntries(Array.isArray(result.entries) ? result.entries : [])
    } catch {
      setError('Could not load shared notes.')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [paired])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const openItem = async (entry: SharedInboxItem) => {
    setDetailLoading(true)
    setError(null)
    try {
      const result = (await window.electronAPI.invoke('share:get-item', {
        communityId: entry.communityId,
        itemId: entry.id,
      })) as { ok?: boolean; error?: string; item?: SharedItemDetail }
      if (!result.ok || !result.item) {
        setError('Could not open that shared note.')
        return
      }
      setSelected(result.item)
    } catch {
      setError('Could not open that shared note.')
    } finally {
      setDetailLoading(false)
    }
  }

  const acceptInvite = async (invite: SharedInboxInvite) => {
    setError(null)
    const result = (await window.electronAPI.invoke('share:accept-invite', {
      token: invite.token,
    })) as { ok?: boolean; error?: string }
    if (!result.ok) {
      if (result.error === 'plan_required') {
        setPlanRequired(true)
        throw new Error('Upgrade required to accept invites')
      }
      throw new Error('Could not accept that invite.')
    }
    await refresh()
    toast('Invite accepted')
  }

  if (selected) {
    const fields = contentFields(selected.content)
    return (
      <div className="shared-view">
        <header className="home-view-header">
          <div>
            <button type="button" className="link-btn" onClick={() => setSelected(null)}>
              ← Shared with me
            </button>
            <h1 className="home-view-title">{selected.title}</h1>
            <p className="home-view-subtitle">
              Shared by {selected.sharedByLabel} · {selected.communityName} ·{' '}
              {formatWhen(selected.createdAt)}
            </p>
          </div>
        </header>

        <div className="shared-detail">
          {fields.summary ? (
            <section className="shared-detail-section">
              <h2>Summary</h2>
              <p>{fields.summary}</p>
            </section>
          ) : null}
          {fields.enhancedNotes ? (
            <section className="shared-detail-section">
              <h2>Notes</h2>
              <pre className="shared-detail-pre">{fields.enhancedNotes}</pre>
            </section>
          ) : null}
          {fields.actionItems && fields.actionItems.length > 0 ? (
            <section className="shared-detail-section">
              <h2>Action items</h2>
              <ul>
                {fields.actionItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {fields.userNotes ? (
            <section className="shared-detail-section">
              <h2>Shared notes</h2>
              <pre className="shared-detail-pre">{fields.userNotes}</pre>
            </section>
          ) : null}
          {fields.transcript && fields.transcript.length > 0 ? (
            <section className="shared-detail-section">
              <h2>Transcript</h2>
              <div className="shared-transcript">
                {fields.transcript.map((line, index) => (
                  <p key={`${line.speaker}-${index}`}>
                    <strong>{line.speaker}</strong> {line.text}
                  </p>
                ))}
              </div>
            </section>
          ) : null}
          {!fields.summary &&
          !fields.enhancedNotes &&
          !fields.userNotes &&
          !(fields.actionItems && fields.actionItems.length) &&
          !(fields.transcript && fields.transcript.length) ? (
            <p className="home-muted">This shared note has no readable content yet.</p>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="shared-view">
      <header className="home-view-header">
        <div>
          <h1 className="home-view-title">Shared with me</h1>
          <p className="home-view-subtitle">
            Meeting notes others shared with you. Read-only in Clarifi.
          </p>
        </div>
      </header>

      {!paired ? (
        <div className="chat-connect-banner">
          <span>Connect your account to see notes shared with you.</span>
          <button type="button" className="btn btn-primary" onClick={onConnect}>
            Connect
          </button>
        </div>
      ) : null}

      {paired && planRequired ? (
        <div className="chat-connect-banner">
          <span>Shared notes require Pro+. Upgrade to accept invites and open shared recaps.</span>
          <button type="button" className="btn btn-primary" onClick={onOpenDashboard}>
            Open dashboard
          </button>
        </div>
      ) : null}

      {error ? <p className="chat-error">{error}</p> : null}
      {detailLoading ? <p className="home-muted">Opening…</p> : null}

      {loading ? (
        <p className="home-muted">Loading shared notes…</p>
      ) : entries.length === 0 && paired && !planRequired ? (
        <div className="shared-empty">
          <p>Nothing shared with you yet.</p>
          <p className="home-muted">
            When a teammate invites you or shares a recap, it will show up here.
          </p>
        </div>
      ) : (
        <ul className="shared-list">
          {entries.map((entry) =>
            entry.kind === 'invite' ? (
              <li key={`invite-${entry.id}`} className="shared-list-row shared-list-invite">
                <div className="shared-list-body">
                  <div className="shared-list-title">Invite · {entry.communityName}</div>
                  <div className="shared-list-meta">
                    Expires {formatWhen(entry.expiresAt)}
                  </div>
                </div>
                <StatefulButton
                  variant="primary"
                  idleLabel="Accept"
                  loadingLabel="Accepting…"
                  successLabel="Accepted"
                  successDuration={1200}
                  onClick={() => acceptInvite(entry)}
                />
              </li>
            ) : (
              <li key={`item-${entry.id}`}>
                <button
                  type="button"
                  className="shared-list-row"
                  onClick={() => void openItem(entry)}
                >
                  <div className="shared-list-body">
                    <div className="shared-list-title">{entry.title}</div>
                    <div className="shared-list-meta">
                      {entry.sharedByLabel} · {entry.communityName} · {formatWhen(entry.createdAt)}
                    </div>
                    {entry.preview ? (
                      <div className="shared-list-preview">{entry.preview}</div>
                    ) : null}
                  </div>
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}
