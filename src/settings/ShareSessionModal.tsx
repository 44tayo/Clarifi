import { useEffect, useState } from 'react'
import type { CommunityFolder, CommunitySummary, StoredAudioSession } from './types'

type ShareSessionModalProps = {
  session: StoredAudioSession | null
  onClose: () => void
}

export function ShareSessionModal({ session, onClose }: ShareSessionModalProps) {
  const [communities, setCommunities] = useState<CommunitySummary[]>([])
  const [folders, setFolders] = useState<CommunityFolder[]>([])
  const [communityId, setCommunityId] = useState('')
  const [folderId, setFolderId] = useState('')
  const [includeRecap, setIncludeRecap] = useState(true)
  const [includeTranscript, setIncludeTranscript] = useState(true)
  const [includeNotes, setIncludeNotes] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!session) return
    void window.electronAPI.invoke('community:list').then((data) => {
      const payload = data as { communities?: CommunitySummary[] }
      const list = payload.communities ?? []
      setCommunities(list)
      if (list[0]) setCommunityId(list[0].id)
    })
  }, [session])

  useEffect(() => {
    if (!communityId) {
      setFolders([])
      setFolderId('')
      return
    }
    void window.electronAPI.invoke('community:folders', { communityId }).then((data) => {
      const payload = data as { folders?: CommunityFolder[] }
      const list = payload.folders ?? []
      setFolders(list)
      if (list[0]) setFolderId(list[0].id)
    })
  }, [communityId])

  if (!session) return null

  const handleShare = async () => {
    if (!communityId) return
    setLoading(true)
    setError('')
    try {
      const result = (await window.electronAPI.invoke('community:share-session', {
        communityId,
        folderId: folderId || null,
        sessionId: session.id,
        includeRecap,
        includeTranscript,
        includeNotes,
      })) as { ok?: boolean; error?: string; itemsCreated?: number }

      if (!result.ok) {
        setError(result.error ?? 'share_failed')
        return
      }
      setSuccess(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="settings-modal-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="settings-modal-title">Share to community</h2>
        <p className="settings-modal-desc">
          Share &ldquo;{session.title}&rdquo; with your team. Invitees need Pro+.
        </p>

        {communities.length === 0 ? (
          <p className="settings-empty">Create a community first in the Community tab.</p>
        ) : (
          <>
            <div className="settings-field">
              <label>Community</label>
              <select
                className="settings-input"
                value={communityId}
                onChange={(e) => setCommunityId(e.target.value)}
              >
                {communities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-field">
              <label>Folder</label>
              <select
                className="settings-input"
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
              >
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-share-options">
              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={includeRecap}
                  onChange={(e) => setIncludeRecap(e.target.checked)}
                  disabled={!session.recap}
                />
                Meeting recap
              </label>
              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={includeTranscript}
                  onChange={(e) => setIncludeTranscript(e.target.checked)}
                  disabled={session.transcript.length === 0}
                />
                Transcript
              </label>
              <label className="settings-checkbox-row">
                <input type="checkbox" checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} />
                Notes
              </label>
            </div>
          </>
        )}

        {error ? <p className="settings-modal-error">{error}</p> : null}
        {success ? (
          <p className="settings-modal-success">Shared successfully.</p>
        ) : null}

        <div className="settings-modal-actions">
          <button type="button" className="settings-btn" onClick={onClose}>
            {success ? 'Close' : 'Cancel'}
          </button>
          {!success && communities.length > 0 ? (
            <button
              type="button"
              className="settings-btn primary"
              disabled={loading || !communityId}
              onClick={() => void handleShare()}
            >
              {loading ? 'Sharing…' : 'Share'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
