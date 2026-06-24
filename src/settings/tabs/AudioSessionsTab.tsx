import { SettingsPageHeader } from '../SettingsPageHeader'
import type { StoredAudioSession } from '../types'
import { formatHistoryTime, formatSessionDuration } from '../utils'

type AudioSessionsTabProps = {
  sessions: StoredAudioSession[]
  renamingId: string | null
  renameDraft: string
  onRenameDraft: (value: string) => void
  onStartRename: (session: StoredAudioSession) => void
  onCancelRename: () => void
  onSaveRename: (id: string) => void
  onOpen: (id: string) => void
  onShare: (session: StoredAudioSession) => void
  onDelete: (id: string) => void
  canShare: boolean
}

export function AudioSessionsTab({
  sessions,
  renamingId,
  renameDraft,
  onRenameDraft,
  onStartRename,
  onCancelRename,
  onSaveRename,
  onOpen,
  onShare,
  onDelete,
  canShare,
}: AudioSessionsTabProps) {
  return (
    <>
      <SettingsPageHeader
        title="Audio sessions"
        description="Past meeting recordings with transcripts, recaps, and session-scoped AI chat."
      />

      {sessions.length === 0 ? (
        <div className="settings-empty-state">
          <p className="settings-empty">
            No audio sessions yet. Start and stop a session from the overlay.
          </p>
        </div>
      ) : (
        <div className="settings-list-view">
          {sessions.map((session) => (
            <div key={session.id} className="settings-list-row">
              <div className="settings-list-row-main">
                {renamingId === session.id ? (
                  <input
                    className="settings-history-rename-input"
                    value={renameDraft}
                    onChange={(e) => onRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void onSaveRename(session.id)
                      if (e.key === 'Escape') onCancelRename()
                    }}
                    autoFocus
                  />
                ) : (
                  <div className="settings-list-row-title">{session.title}</div>
                )}
                <div className="settings-list-row-meta">
                  {formatHistoryTime(session.createdAt)}
                  {' · '}
                  {formatSessionDuration(session.createdAt, session.endedAt)}
                  {' · '}
                  {session.transcript.length} line{session.transcript.length === 1 ? '' : 's'}
                  {session.recap?.summary ? (
                    <span className="settings-list-row-preview">
                      {' · '}
                      {session.recap.summary.slice(0, 80)}
                      {session.recap.summary.length > 80 ? '…' : ''}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="settings-list-row-actions">
                {renamingId === session.id ? (
                  <>
                    <button
                      type="button"
                      className="settings-btn small primary"
                      onClick={() => void onSaveRename(session.id)}
                    >
                      Save
                    </button>
                    <button type="button" className="settings-btn small" onClick={onCancelRename}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="settings-btn small"
                      onClick={() => onOpen(session.id)}
                    >
                      Open
                    </button>
                    {canShare ? (
                      <button
                        type="button"
                        className="settings-btn small primary"
                        onClick={() => onShare(session)}
                      >
                        Share
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="settings-btn small"
                      onClick={() => onStartRename(session)}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="settings-btn small danger"
                      onClick={() => void onDelete(session.id)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
