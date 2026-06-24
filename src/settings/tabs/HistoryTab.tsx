import { SettingsPageHeader } from '../SettingsPageHeader'
import type { ChatSession, HistoryFilter } from '../types'
import { formatHistoryTime } from '../utils'

type HistoryTabProps = {
  historyFilter: HistoryFilter
  sessions: ChatSession[]
  renamingId: string | null
  renameDraft: string
  onFilterChange: (filter: HistoryFilter) => void
  onRenameDraft: (value: string) => void
  onStartRename: (session: ChatSession) => void
  onCancelRename: () => void
  onSaveRename: (id: string) => void
  onOpen: (id: string) => void
  onToggleArchive: (session: ChatSession) => void
  onDelete: (id: string) => void
}

export function HistoryTab({
  historyFilter,
  sessions,
  renamingId,
  renameDraft,
  onFilterChange,
  onRenameDraft,
  onStartRename,
  onCancelRename,
  onSaveRename,
  onOpen,
  onToggleArchive,
  onDelete,
}: HistoryTabProps) {
  return (
    <>
      <SettingsPageHeader
        title="Chat history"
        description="All your overlay conversations. Open, rename, archive, or delete."
      />

      <div className="settings-history-filters">
        {(['all', 'active', 'archived'] as HistoryFilter[]).map((filter) => (
          <button
            key={filter}
            type="button"
            className={`settings-history-filter ${historyFilter === filter ? 'active' : ''}`}
            onClick={() => onFilterChange(filter)}
          >
            {filter === 'all' ? 'All' : filter === 'active' ? 'Active' : 'Archived'}
          </button>
        ))}
      </div>

      {sessions.length === 0 ? (
        <div className="settings-empty-state">
          <p className="settings-empty">No chats in this view yet.</p>
        </div>
      ) : (
        <div className="settings-list-view">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`settings-list-row ${session.archived ? 'settings-list-row--muted' : ''}`}
            >
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
                  {session.messages.length} message{session.messages.length === 1 ? '' : 's'}
                  {session.archived ? ' · Archived' : ''}
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
                    <button
                      type="button"
                      className="settings-btn small"
                      onClick={() => onStartRename(session)}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="settings-btn small"
                      onClick={() => void onToggleArchive(session)}
                    >
                      {session.archived ? 'Restore' : 'Archive'}
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
