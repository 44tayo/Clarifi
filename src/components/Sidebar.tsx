import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

import { FREE_HISTORY_RETENTION_DAYS } from '../../shared/entitlements'
import type { Folder, ConnectionStatus, Meeting } from '../types/meeting'
import type { SidebarSelection } from '../types/navigation'

type SidebarProps = {
  selection: SidebarSelection
  onSelectView: (selection: SidebarSelection) => void
  meetings: Meeting[]
  onSelectMeeting: (id: string) => void
  folders: Folder[]
  onCreateFolder: (name: string) => void
  onRenameFolder: (id: string, name: string) => void
  onDeleteFolder: (id: string) => void
  allTags: string[]
  connection: ConnectionStatus
  calendarConnected?: boolean
  onNewMeeting: () => void
  onConnect: () => void
  onOpenDashboard: () => void
  onOpenSettings: () => void
  onConnectCalendar?: () => void
  resizing?: boolean
  onResizePointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void
  onResizeDoubleClick?: () => void
}

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <span className="sidebar-nav-icon" aria-hidden>
      {children}
    </span>
  )
}

function accountInitial(email?: string) {
  const trimmed = email?.trim()
  if (!trimmed) return 'C'
  return trimmed.charAt(0).toUpperCase()
}

function planDisplay(connection: ConnectionStatus): string {
  if (connection.planLabel?.trim()) return connection.planLabel.trim()
  if (connection.plan === 'pro_plus') return 'Pro+'
  if (connection.plan === 'pro') return 'Pro'
  if (!connection.paired) return 'Not connected'
  return `Free · ${FREE_HISTORY_RETENTION_DAYS}d history`
}

function isPaidPlan(connection: ConnectionStatus): boolean {
  return connection.plan === 'pro' || connection.plan === 'pro_plus'
}

const TRIAL_TOTAL_DAYS = 30

function trialDayProgress(trialEndsAtIso: string): {
  daysLeft: number
  daysUsed: number
  ratio: number
} {
  const ends = Date.parse(trialEndsAtIso)
  if (!Number.isFinite(ends)) {
    return { daysLeft: 0, daysUsed: TRIAL_TOTAL_DAYS, ratio: 1 }
  }
  const dayMs = 24 * 60 * 60 * 1000
  const starts = ends - TRIAL_TOTAL_DAYS * dayMs
  const now = Date.now()
  const daysLeft = Math.max(0, Math.ceil((ends - now) / dayMs))
  const daysUsed = Math.min(TRIAL_TOTAL_DAYS, Math.max(0, Math.floor((now - starts) / dayMs)))
  const ratio = Math.min(1, Math.max(0, daysUsed / TRIAL_TOTAL_DAYS))
  return { daysLeft, daysUsed, ratio }
}

export function Sidebar({
  selection,
  onSelectView,
  meetings,
  onSelectMeeting,
  folders,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  allTags,
  connection,
  calendarConnected = false,
  onNewMeeting,
  onConnect,
  onOpenDashboard,
  onOpenSettings,
  onConnectCalendar,
  resizing = false,
  onResizePointerDown,
  onResizeDoubleClick,
}: SidebarProps) {
  const [accountOpen, setAccountOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const plan = planDisplay(connection)
  const paid = isPaidPlan(connection)
  const trial =
    connection.trialActive && connection.trialEndsAt
      ? trialDayProgress(connection.trialEndsAt)
      : null
  const ctaLabel = connection.trialActive || !paid ? 'Upgrade' : 'Manage plan'

  useEffect(() => {
    if (!accountOpen) return
    const onPointer = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [accountOpen])

  const isActive = (view: SidebarSelection['view'], id?: string) => {
    if (view === 'folder') {
      return selection.view === 'folder' && selection.folderId === id
    }
    if (view === 'tag') {
      return selection.view === 'tag' && selection.tagName === id
    }
    return selection.view === view
  }

  const recentMeetings = useMemo(
    () =>
      [...meetings]
        .sort((a, b) => (b.startedAt ?? b.createdAt) - (a.startedAt ?? a.createdAt))
        .slice(0, 6),
    [meetings],
  )

  const runAndClose = (action: () => void) => {
    setAccountOpen(false)
    action()
  }

  return (
    <aside className={`sidebar${accountOpen ? ' is-account-menu-open' : ''}`}>
      <div
        className={`sidebar-resize-handle${resizing ? ' is-dragging' : ''}`}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onPointerDown={onResizePointerDown}
        onDoubleClick={onResizeDoubleClick}
      />
      <div className="sidebar-header">
        {/* Spacer so the fixed sidebar toggle doesn’t overlap New meeting */}
        <div className="sidebar-header-top" aria-hidden="true" />
        <button type="button" className="sidebar-start-btn" onClick={onNewMeeting}>
          + New meeting
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Main">
        <button
          type="button"
          className={`sidebar-nav-item${isActive('home') ? ' is-active' : ''}`}
          onClick={() => onSelectView({ view: 'home' })}
        >
          <NavIcon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
            </svg>
          </NavIcon>
          Home
        </button>

        <button
          type="button"
          className={`sidebar-nav-item${isActive('chat') ? ' is-active' : ''}`}
          onClick={() => onSelectView({ view: 'chat' })}
        >
          <NavIcon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H10l-4 3.5V16H7.5A2.5 2.5 0 0 1 5 13.5v-7Z" />
            </svg>
          </NavIcon>
          Chat
        </button>

        <button
          type="button"
          className={`sidebar-nav-item${isActive('meetings') ? ' is-active' : ''}`}
          onClick={() => onSelectView({ view: 'meetings' })}
        >
          <NavIcon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="4" y="5" width="16" height="15" rx="2" />
              <path d="M8 3v4M16 3v4M4 10h16" />
            </svg>
          </NavIcon>
          Meetings
        </button>

        <button
          type="button"
          className={`sidebar-nav-item${isActive('shared') ? ' is-active' : ''}`}
          onClick={() => onSelectView({ view: 'shared' })}
        >
          <NavIcon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="2.5" />
              <circle cx="6" cy="12" r="2.5" />
              <circle cx="18" cy="19" r="2.5" />
              <path d="M8.4 13.2 15.6 17.3M15.6 6.7 8.4 10.8" />
            </svg>
          </NavIcon>
          Shared with me
        </button>

        <button type="button" className="sidebar-nav-item" onClick={onOpenSettings}>
          <NavIcon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
            </svg>
          </NavIcon>
          Settings
        </button>

        <div className="sidebar-nav-section">
          <div className="sidebar-flyout-section-row">
            <p className="sidebar-flyout-section">Folders</p>
            <button
              type="button"
              className="sidebar-flyout-section-add"
              aria-label="New folder"
              title="New folder"
              onClick={() => {
                const name = window.prompt('Folder name', 'New folder')
                if (name?.trim()) onCreateFolder(name.trim())
              }}
            >
              +
            </button>
          </div>
          {folders.length === 0 ? (
            <p className="sidebar-flyout-empty">No folders yet</p>
          ) : (
            folders.map((folder) => (
              <div key={folder.id} className="sidebar-flyout-folder-row">
                <button
                  type="button"
                  className={`sidebar-flyout-item${isActive('folder', folder.id) ? ' is-active' : ''}`}
                  onClick={() => onSelectView({ view: 'folder', folderId: folder.id })}
                  onDoubleClick={() => {
                    const name = window.prompt('Rename folder', folder.name)
                    if (name?.trim() && name.trim() !== folder.name) {
                      onRenameFolder(folder.id, name.trim())
                    }
                  }}
                  title="Double-click to rename"
                >
                  <span className="sidebar-flyout-item-icon" aria-hidden>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3.5 8.5A2.5 2.5 0 0 1 6 6h4l2 2h6a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5v-9Z" />
                    </svg>
                  </span>
                  {folder.name}
                </button>
                <button
                  type="button"
                  className="sidebar-flyout-folder-delete"
                  aria-label={`Delete ${folder.name}`}
                  onClick={() => {
                    if (window.confirm(`Delete folder “${folder.name}”? Meetings stay in Meetings.`)) {
                      onDeleteFolder(folder.id)
                      if (selection.view === 'folder' && selection.folderId === folder.id) {
                        onSelectView({ view: 'meetings' })
                      }
                    }
                  }}
                >
                  ×
                </button>
              </div>
            ))
          )}

          {allTags.length > 0 ? (
            <>
              <p className="sidebar-flyout-section">Tags</p>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`sidebar-flyout-item${isActive('tag', tag) ? ' is-active' : ''}`}
                  onClick={() => onSelectView({ view: 'tag', tagName: tag })}
                >
                  <span className="sidebar-flyout-item-icon" aria-hidden>
                    #
                  </span>
                  {tag}
                </button>
              ))}
            </>
          ) : null}

          <p className="sidebar-flyout-section">Recent</p>
          {recentMeetings.length === 0 ? (
            <p className="sidebar-flyout-empty">No meetings yet</p>
          ) : (
            recentMeetings.map((meeting) => (
              <button
                key={meeting.id}
                type="button"
                className="sidebar-flyout-item"
                onClick={() => onSelectMeeting(meeting.id)}
              >
                {meeting.title}
              </button>
            ))
          )}
        </div>
      </nav>

      <div className="sidebar-footer" ref={accountMenuRef}>
        {accountOpen ? (
          <div className="sidebar-account-menu" role="menu" aria-label="Account">
            <div className="sidebar-account-menu-header">
              <span className="account-chip-avatar" aria-hidden>
                {connection.paired ? accountInitial(connection.email) : '?'}
              </span>
              <div className="sidebar-account-menu-meta">
                <strong className="sidebar-account-menu-email">
                  {connection.paired ? connection.email ?? 'Connected' : 'Not connected'}
                </strong>
                <span className="sidebar-account-menu-plan">{plan}</span>
              </div>
            </div>

            {trial ? (
              <div className="sidebar-account-trial" aria-label="Free trial progress">
                <div className="sidebar-account-trial-row">
                  <span className="sidebar-account-trial-label">
                    {plan} trial
                  </span>
                  <span className="sidebar-account-trial-days">
                    {trial.daysLeft === 0
                      ? 'Last day'
                      : trial.daysLeft === 1
                        ? '1 day left'
                        : `${trial.daysLeft} days left`}
                  </span>
                </div>
                <div
                  className="sidebar-account-trial-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={TRIAL_TOTAL_DAYS}
                  aria-valuenow={trial.daysUsed}
                  aria-label={`${trial.daysUsed} of ${TRIAL_TOTAL_DAYS} trial days used`}
                >
                  <span
                    className="sidebar-account-trial-fill"
                    style={{ width: `${Math.round(trial.ratio * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}

            {connection.paired ? (
              <button
                type="button"
                className="sidebar-account-menu-cta"
                role="menuitem"
                onClick={() => runAndClose(onOpenDashboard)}
              >
                {ctaLabel}
              </button>
            ) : (
              <button
                type="button"
                className="sidebar-account-menu-cta"
                role="menuitem"
                onClick={() => runAndClose(onConnect)}
              >
                Connect account
              </button>
            )}

            <div className="sidebar-account-menu-actions">
              <button
                type="button"
                className="sidebar-account-menu-item"
                role="menuitem"
                onClick={() => runAndClose(onOpenSettings)}
              >
                Settings
              </button>
              {connection.paired ? (
                <button
                  type="button"
                  className="sidebar-account-menu-item"
                  role="menuitem"
                  onClick={() => runAndClose(onOpenDashboard)}
                >
                  Open dashboard
                </button>
              ) : null}
              {connection.paired && !calendarConnected && onConnectCalendar ? (
                <button
                  type="button"
                  className="sidebar-account-menu-item"
                  role="menuitem"
                  onClick={() => runAndClose(onConnectCalendar)}
                >
                  Connect calendar
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className={`sidebar-account-trigger${accountOpen ? ' is-open' : ''}`}
          aria-expanded={accountOpen}
          aria-haspopup="menu"
          onClick={() => setAccountOpen((open) => !open)}
        >
          <span className="account-chip-avatar" aria-hidden>
            {connection.paired ? accountInitial(connection.email) : '?'}
          </span>
          <span className="account-chip-meta">
            <span className="account-chip-email">
              {connection.paired ? connection.email ?? 'Connected' : 'Not connected'}
            </span>
            <span className="account-chip-plan">{plan}</span>
          </span>
          <span className="sidebar-account-chevron" aria-hidden>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M3 7.5 6 4.5 9 7.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      </div>
    </aside>
  )
}
