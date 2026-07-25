import {
  useMemo,
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
  connection: ConnectionStatus
  onNewMeeting: () => void
  onConnect: () => void
  onOpenDashboard: () => void
  onOpenSettings: () => void
  resizing?: boolean
  onResizePointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void
  onResizeDoubleClick?: () => void
  onCollapse?: () => void
}

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <span className="sidebar-nav-icon" aria-hidden>
      {children}
    </span>
  )
}

function Chevron({ open }: { open?: boolean }) {
  return (
    <span className={`sidebar-nav-chevron${open ? ' is-open' : ''}`} aria-hidden>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M4.5 2.5 8 6 4.5 9.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

function accountInitial(email?: string) {
  const trimmed = email?.trim()
  if (!trimmed) return 'C'
  return trimmed.charAt(0).toUpperCase()
}

type AccordionProps = {
  label: string
  active: boolean
  icon: ReactNode
  onOpenAll: () => void
  onAdd?: () => void
  addLabel?: string
  children: ReactNode
}

function NavAccordion({ label, active, icon, onOpenAll, onAdd, addLabel, children }: AccordionProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`sidebar-nav-accordion${open ? ' is-open' : ''}${active ? ' is-active' : ''}`}>
      <div className="sidebar-nav-accordion-trigger">
        <button
          type="button"
          className={`sidebar-nav-item sidebar-nav-accordion-main${active ? ' is-active' : ''}`}
          aria-expanded={open}
          onClick={() => {
            setOpen((prev) => !prev)
            onOpenAll()
          }}
        >
          <NavIcon>{icon}</NavIcon>
          <span className="sidebar-nav-accordion-label">{label}</span>
          <Chevron open={open} />
        </button>
        {onAdd ? (
          <button
            type="button"
            className="sidebar-nav-accordion-add"
            aria-label={addLabel ?? `New ${label}`}
            title={addLabel ?? `New ${label}`}
            onClick={(event) => {
              event.stopPropagation()
              onAdd()
            }}
          >
            +
          </button>
        ) : null}
      </div>
      {open ? <div className="sidebar-nav-accordion-panel">{children}</div> : null}
    </div>
  )
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
  connection,
  onNewMeeting,
  onConnect,
  onOpenDashboard,
  onOpenSettings,
  resizing = false,
  onResizePointerDown,
  onResizeDoubleClick,
  onCollapse,
}: SidebarProps) {
  const isActive = (view: SidebarSelection['view'], folderId?: string) => {
    if (view === 'folder') {
      return selection.view === 'folder' && selection.folderId === folderId
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

  return (
    <aside className="sidebar">
      <div
        className={`sidebar-resize-handle${resizing ? ' is-dragging' : ''}`}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onPointerDown={onResizePointerDown}
        onDoubleClick={onResizeDoubleClick}
      />
      <div className="sidebar-header">
        <div className="sidebar-header-top">
          <div className="sidebar-brand">
            <img
              className="sidebar-brand-mark"
              src={`${import.meta.env.BASE_URL}clarifi-logo.png`}
              alt=""
              width={22}
              height={22}
              draggable={false}
            />
            <span className="sidebar-brand-name">Clarifi</span>
          </div>
          {onCollapse ? (
            <button
              type="button"
              className="sidebar-collapse-btn no-drag"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              onClick={onCollapse}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
                <path d="M9.5 4.5v15" />
              </svg>
            </button>
          ) : null}
        </div>
        <button type="button" className="sidebar-start-btn" onClick={onNewMeeting}>
          New meeting
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

        <NavAccordion
          label="Chat"
          active={isActive('chat')}
          onOpenAll={() => onSelectView({ view: 'chat' })}
          onAdd={() => onSelectView({ view: 'chat' })}
          addLabel="New chat"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H10l-4 3.5V16H7.5A2.5 2.5 0 0 1 5 13.5v-7Z" />
            </svg>
          }
        >
          <p className="sidebar-flyout-empty">Ask across your meetings</p>
          <button
            type="button"
            className="sidebar-flyout-item"
            onClick={() => onSelectView({ view: 'chat' })}
          >
            Open chat
          </button>
        </NavAccordion>

        <NavAccordion
          label="Meetings"
          active={isActive('meetings') || selection.view === 'folder'}
          onOpenAll={() => onSelectView({ view: 'meetings' })}
          onAdd={onNewMeeting}
          addLabel="New meeting"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="4" y="5" width="16" height="15" rx="2" />
              <path d="M8 3v4M16 3v4M4 10h16" />
            </svg>
          }
        >
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
          {folders.map((folder) => (
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
          ))}

          <p className="sidebar-flyout-section">Meetings</p>
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
        </NavAccordion>

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

        <button
          type="button"
          className="sidebar-nav-item"
          onClick={onOpenSettings}
        >
          <NavIcon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
            </svg>
          </NavIcon>
          Settings
        </button>
      </nav>

      <div className="sidebar-footer">
        {connection.paired ? (
          <div className="account-chip account-chip-compact">
            <span className="account-chip-avatar" aria-hidden>
              {accountInitial(connection.email)}
            </span>
            <div className="account-chip-meta">
              <span className="account-chip-email">{connection.email ?? 'Connected'}</span>
              <span className="account-chip-plan">
                {connection.planLabel ??
                  (connection.plan !== 'pro' && connection.plan !== 'pro_plus'
                    ? `Free · ${FREE_HISTORY_RETENTION_DAYS}d`
                    : 'Plan')}
              </span>
            </div>
          </div>
        ) : (
          <div className="account-chip account-chip-compact">
            <span className="account-chip-avatar" aria-hidden>
              ?
            </span>
            <div className="account-chip-meta">
              <span className="account-chip-email">Not connected</span>
              <button type="button" className="link-btn" onClick={onConnect}>
                Connect account
              </button>
            </div>
          </div>
        )}
        {connection.paired ? (
          <button type="button" className="link-btn sidebar-dashboard-link" onClick={onOpenDashboard}>
            Open dashboard
          </button>
        ) : null}
      </div>
    </aside>
  )
}
