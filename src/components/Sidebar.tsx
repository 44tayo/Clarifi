import { FREE_HISTORY_RETENTION_DAYS } from '../../shared/entitlements'
import { MeetingRow } from './MeetingRow'
import type { ConnectionStatus, Meeting } from '../types/meeting'

const FREE_HISTORY_RETENTION_MS = FREE_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000

type SidebarProps = {
  meetings: Meeting[]
  selectedId: string | null
  connection: ConnectionStatus
  onSelect: (id: string) => void
  onNewMeeting: () => void
  onConnect: () => void
  onOpenDashboard: () => void
  onOpenSettings: () => void
}

function isMeetingLocked(meeting: Meeting, plan?: string): boolean {
  if (plan === 'pro' || plan === 'pro_plus') return false
  const at = meeting.startedAt ?? meeting.createdAt
  return Date.now() - at > FREE_HISTORY_RETENTION_MS
}

export function Sidebar({
  meetings,
  selectedId,
  connection,
  onSelect,
  onNewMeeting,
  onConnect,
  onOpenDashboard,
  onOpenSettings,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark" aria-hidden="true">
            C
          </div>
          <span className="sidebar-brand-name">Clarifi</span>
        </div>
        <button type="button" className="sidebar-new-btn" onClick={onNewMeeting}>
          New meeting note
        </button>
      </div>

      <div className="sidebar-section-label">Recent</div>
      <div className="sidebar-list">
        {meetings.length === 0 ? (
          <p className="transcript-empty" style={{ padding: '8px 12px' }}>
            No meetings yet
          </p>
        ) : (
          meetings.map((meeting) => {
            const locked = isMeetingLocked(meeting, connection.plan)
            return (
              <MeetingRow
                key={meeting.id}
                meeting={meeting}
                active={meeting.id === selectedId}
                locked={locked}
                onSelect={locked ? () => onOpenDashboard() : onSelect}
              />
            )
          })
        )}
      </div>

      <div className="sidebar-footer">
        {connection.paired ? (
          <div className="account-chip">
            <span className="account-chip-label">Account</span>
            <span className="account-chip-email">{connection.email ?? 'Connected'}</span>
            {connection.planLabel ? (
              <span className="account-chip-label">{connection.planLabel}</span>
            ) : null}
            {connection.plan !== 'pro' && connection.plan !== 'pro_plus' ? (
              <span className="account-chip-label">
                Free plan · {FREE_HISTORY_RETENTION_DAYS} days of history
              </span>
            ) : null}
            <button type="button" className="link-btn" onClick={onOpenDashboard}>
              Open dashboard
            </button>
          </div>
        ) : (
          <div className="account-chip">
            <span className="account-chip-label">Sign in to sync & enhance notes</span>
            <button type="button" className="link-btn" onClick={onConnect}>
              Connect account
            </button>
          </div>
        )}
        <button type="button" className="link-btn sidebar-settings-btn" onClick={onOpenSettings}>
          Settings
        </button>
      </div>
    </aside>
  )
}
