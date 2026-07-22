import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'

import { FREE_HISTORY_RETENTION_DAYS } from '../../shared/entitlements'
import type { Folder, ConnectionStatus } from '../types/meeting'
import type { SidebarSelection } from '../types/navigation'

type SidebarProps = {
  selection: SidebarSelection
  onSelectView: (selection: SidebarSelection) => void
  folders: Folder[]
  onCreateFolder: (name: string) => void
  onRenameFolder: (id: string, name: string) => void
  onDeleteFolder: (id: string) => void
  connection: ConnectionStatus
  onNewMeeting: () => void
  onConnect: () => void
  onOpenDashboard: () => void
  onOpenSettings: () => void
  onOpenSearch?: () => void
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

export function Sidebar({
  selection,
  onSelectView,
  folders,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  connection,
  onNewMeeting,
  onConnect,
  onOpenDashboard,
  onOpenSettings,
  onOpenSearch,
  resizing = false,
  onResizePointerDown,
  onResizeDoubleClick,
}: SidebarProps) {
  const isActive = (view: SidebarSelection['view'], folderId?: string) => {
    if (view === 'folder') {
      return selection.view === 'folder' && selection.folderId === folderId
    }
    return selection.view === view
  }

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
        <div className="sidebar-brand">
          <img
            className="sidebar-brand-mark"
            src={`${import.meta.env.BASE_URL}clarifi-logo.png`}
            alt=""
            width={28}
            height={28}
            draggable={false}
          />
          <span className="sidebar-brand-name">Clarifi</span>
        </div>
        <button type="button" className="sidebar-start-btn" onClick={onNewMeeting}>
          Start meeting
        </button>
        {onOpenSearch ? (
          <button type="button" className="sidebar-search-btn" onClick={onOpenSearch}>
            <span>Search</span>
            <kbd>⌘K</kbd>
          </button>
        ) : null}
      </div>

      <nav className="sidebar-nav" aria-label="Main">
        <button
          type="button"
          className={`sidebar-nav-item${isActive('home') ? ' is-active' : ''}`}
          onClick={() => onSelectView({ view: 'home' })}
        >
          <NavIcon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="2.5" />
              <circle cx="6" cy="12" r="2.5" />
              <circle cx="18" cy="19" r="2.5" />
              <path d="M8.4 13.2 15.6 17.3M15.6 6.7 8.4 10.8" />
            </svg>
          </NavIcon>
          Shared with me
        </button>
      </nav>

      <div className="sidebar-section-label sidebar-section-label-row">
        <span>Folders</span>
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            const name = window.prompt('Folder name', 'New folder')
            if (name?.trim()) onCreateFolder(name.trim())
          }}
        >
          Add folder
        </button>
      </div>

      <div className="sidebar-folder-list">
        {folders.length === 0 ? (
          <p className="sidebar-calendar-empty">No folders yet</p>
        ) : (
          folders.map((folder) => (
            <div key={folder.id} className="sidebar-folder-row">
              <button
                type="button"
                className={`sidebar-folder-item${isActive('folder', folder.id) ? ' is-active' : ''}`}
                onClick={() => onSelectView({ view: 'folder', folderId: folder.id })}
                onDoubleClick={() => {
                  const name = window.prompt('Rename folder', folder.name)
                  if (name?.trim() && name.trim() !== folder.name) {
                    onRenameFolder(folder.id, name.trim())
                  }
                }}
                title="Double-click to rename"
              >
                <NavIcon>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M3.5 8.5A2.5 2.5 0 0 1 6 6h4l2 2h6a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5v-9Z" />
                  </svg>
                </NavIcon>
                {folder.name}
              </button>
              <button
                type="button"
                className="sidebar-folder-delete"
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
