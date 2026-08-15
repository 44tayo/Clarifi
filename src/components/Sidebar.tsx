import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

import { FREE_HISTORY_RETENTION_DAYS } from '../../shared/entitlements'
import { buildFolderTree, canReparentFolder, type FolderTreeNode } from '../../shared/folderAppearance'
import { formatRecordingElapsed } from '../../shared/formatElapsed'
import { beginMeetingDrag, endMeetingDrag } from '../lib/meetingDragPreview'
import type { Folder, ConnectionStatus, Meeting } from '../types/meeting'
import type { SidebarSelection } from '../types/navigation'
import { FolderGlyph } from './FolderGlyph'

type SidebarProps = {
  selection: SidebarSelection
  onSelectView: (selection: SidebarSelection) => void
  meetings: Meeting[]
  onSelectMeeting: (id: string) => void
  folders: Folder[]
  onCreateFolder: (parentId?: string | null) => void
  onEditFolder: (id: string) => void
  onRenameFolder: (id: string, name: string) => void
  onUpdateFolder: (
    id: string,
    patch: { parentId?: string | null; sortOrder?: number; name?: string },
  ) => void
  onReorderFolders: (orderedIds: string[], parentId: string | null) => void
  onDeleteFolder: (id: string) => void
  onDropMeetingOnFolder: (meetingId: string, folderId: string) => void
  allTags: string[]
  connection: ConnectionStatus
  calendarConnected?: boolean
  onNewMeeting: () => void
  onConnect: () => void
  onOpenDashboard: () => void
  onOpenSettings: () => void
  onConnectCalendar?: () => void
  liveMeeting?: {
    id: string
    title: string
    startedAt: number
    paused?: boolean
  } | null
  onOpenLiveMeeting?: () => void
  onStopLiveMeeting?: () => void
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
  onEditFolder,
  onRenameFolder,
  onUpdateFolder,
  onReorderFolders,
  onDeleteFolder,
  onDropMeetingOnFolder,
  allTags,
  connection,
  calendarConnected = false,
  onNewMeeting,
  onConnect,
  onOpenDashboard,
  onOpenSettings,
  onConnectCalendar,
  liveMeeting = null,
  onOpenLiveMeeting,
  onStopLiveMeeting,
  resizing = false,
  onResizePointerDown,
  onResizeDoubleClick,
}: SidebarProps) {
  const [accountOpen, setAccountOpen] = useState(false)
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [liveElapsed, setLiveElapsed] = useState('0:00')
  const [dragFolderId, setDragFolderId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const folderEditCancelRef = useRef(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const plan = planDisplay(connection)
  const paid = isPaidPlan(connection)
  const trial =
    connection.trialActive && connection.trialEndsAt
      ? trialDayProgress(connection.trialEndsAt)
      : null
  const ctaLabel = connection.trialActive || !paid ? 'Upgrade' : 'Manage plan'
  const folderTree = useMemo(() => buildFolderTree(folders), [folders])

  useEffect(() => {
    if (!liveMeeting?.startedAt) {
      setLiveElapsed('0:00')
      return
    }
    const tick = () => {
      setLiveElapsed(
        liveMeeting.paused
          ? 'Paused'
          : formatRecordingElapsed(liveMeeting.startedAt),
      )
    }
    tick()
    if (liveMeeting.paused) return
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [liveMeeting?.startedAt, liveMeeting?.paused, liveMeeting?.id])

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

  useEffect(() => {
    if (!renamingFolderId) return
    renameInputRef.current?.focus()
    renameInputRef.current?.select()
  }, [renamingFolderId])

  const commitRename = (id: string) => {
    if (folderEditCancelRef.current) {
      folderEditCancelRef.current = false
      setRenamingFolderId(null)
      setRenameDraft('')
      return
    }
    const name = renameDraft.trim()
    const current = folders.find((folder) => folder.id === id)?.name
    setRenamingFolderId(null)
    setRenameDraft('')
    if (name && name !== current) onRenameFolder(id, name)
  }

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
        {liveMeeting ? (
          <div className="sidebar-live-pin" tabIndex={0}>
            <div className="sidebar-live-pin-idle" aria-hidden="true">
              <span className="sidebar-live-pin-title">
                {liveMeeting.title.trim() || 'Untitled meeting'}
              </span>
              <span className="sidebar-live-pin-timer">{liveElapsed}</span>
            </div>
            <div className="sidebar-live-pin-actions">
              <button
                type="button"
                className="sidebar-live-open"
                onClick={() => onOpenLiveMeeting?.()}
              >
                Open meeting
              </button>
              <button
                type="button"
                className="sidebar-live-stop"
                aria-label="Stop recording"
                onClick={() => onStopLiveMeeting?.()}
              >
                <span className="sidebar-live-stop-icon" aria-hidden />
                Stop
              </button>
            </div>
          </div>
        ) : null}
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

        <div className="sidebar-nav-section">
          <div className="sidebar-flyout-section-row">
            <p className="sidebar-flyout-section">Folders</p>
            <button
              type="button"
              className="sidebar-flyout-section-add"
              aria-label="New folder"
              title="New folder"
              onClick={() => {
                setRenamingFolderId(null)
                setConfirmDeleteId(null)
                onCreateFolder(null)
              }}
            >
              +
            </button>
          </div>
          {folders.length === 0 ? (
            <p className="sidebar-flyout-empty">No folders yet</p>
          ) : null}
          {(() => {
            const renderFolderNode = (node: FolderTreeNode<Folder>, depth: number) => {
              const folder = node
              const onFolderDragStart = (event: ReactDragEvent) => {
                event.dataTransfer.setData('application/x-clarifi-folder', folder.id)
                event.dataTransfer.effectAllowed = 'move'
                setDragFolderId(folder.id)
              }
              const onFolderDragEnd = () => {
                setDragFolderId(null)
                setDropTargetId(null)
              }
              const onFolderDragOver = (event: ReactDragEvent) => {
                const types = Array.from(event.dataTransfer.types)
                const hasFolder = types.includes('application/x-clarifi-folder')
                const hasMeeting = types.includes('application/x-clarifi-meeting')
                if (!hasFolder && !hasMeeting) return
                event.preventDefault()
                setDropTargetId(folder.id)
              }
              const onFolderDrop = (event: ReactDragEvent) => {
                event.preventDefault()
                event.stopPropagation()
                setDropTargetId(null)
                const meetingId = event.dataTransfer.getData('application/x-clarifi-meeting')
                if (meetingId) {
                  onDropMeetingOnFolder(meetingId, folder.id)
                  setDragFolderId(null)
                  return
                }
                const sourceId = event.dataTransfer.getData('application/x-clarifi-folder')
                setDragFolderId(null)
                if (!sourceId || sourceId === folder.id) return
                if (canReparentFolder(folders, sourceId, folder.id)) {
                  onUpdateFolder(sourceId, { parentId: folder.id })
                  return
                }
                const source = folders.find((f) => f.id === sourceId)
                const sharedParent = (source?.parentId ?? null) === (folder.parentId ?? null)
                if (source && sharedParent) {
                  const siblings = folders
                    .filter((f) => (f.parentId ?? null) === (folder.parentId ?? null))
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
                  const ordered = siblings.map((f) => f.id).filter((id) => id !== sourceId)
                  const at = ordered.indexOf(folder.id)
                  ordered.splice(Math.max(0, at), 0, sourceId)
                  onReorderFolders(ordered, folder.parentId ?? null)
                }
              }

              return (
                <div key={folder.id} className="sidebar-folder-branch">
                  <div
                    className={`sidebar-flyout-folder-row${dropTargetId === folder.id ? ' is-drop-target' : ''}${dragFolderId === folder.id ? ' is-dragging' : ''}`}
                    style={depth > 0 ? { paddingLeft: depth * 12 } : undefined}
                    onDragOver={onFolderDragOver}
                    onDragLeave={() => {
                      if (dropTargetId === folder.id) setDropTargetId(null)
                    }}
                    onDrop={onFolderDrop}
                  >
                    {renamingFolderId === folder.id ? (
                      <form
                        className="sidebar-folder-editor"
                        onSubmit={(event) => {
                          event.preventDefault()
                          commitRename(folder.id)
                        }}
                      >
                        <span className="sidebar-flyout-item-icon" aria-hidden>
                          <FolderGlyph icon={folder.icon} color={folder.color} size={14} />
                        </span>
                        <input
                          ref={renameInputRef}
                          className="sidebar-folder-input"
                          value={renameDraft}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          onBlur={() => commitRename(folder.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                              event.preventDefault()
                              folderEditCancelRef.current = true
                              setRenamingFolderId(null)
                              setRenameDraft('')
                            }
                          }}
                          aria-label="Rename folder"
                        />
                      </form>
                    ) : (
                      <button
                        type="button"
                        className={`sidebar-flyout-item${isActive('folder', folder.id) ? ' is-active' : ''}`}
                        draggable
                        onDragStart={onFolderDragStart}
                        onDragEnd={onFolderDragEnd}
                        onClick={() => onSelectView({ view: 'folder', folderId: folder.id })}
                        onDoubleClick={() => {
                          setConfirmDeleteId(null)
                          onEditFolder(folder.id)
                        }}
                        title="Drag to nest · Double-click to edit"
                      >
                        <span className="sidebar-flyout-item-icon" aria-hidden>
                          <FolderGlyph icon={folder.icon} color={folder.color} size={14} />
                        </span>
                        <span className="sidebar-folder-name">{folder.name}</span>
                      </button>
                    )}
                    {confirmDeleteId === folder.id ? (
                      <div className="sidebar-folder-confirm">
                        <button
                          type="button"
                          className="sidebar-folder-confirm-yes"
                          onClick={() => {
                            onDeleteFolder(folder.id)
                            setConfirmDeleteId(null)
                            if (selection.view === 'folder' && selection.folderId === folder.id) {
                              onSelectView({ view: 'meetings' })
                            }
                          }}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          className="sidebar-folder-confirm-no"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="sidebar-folder-actions">
                        {!folder.parentId ? (
                          <button
                            type="button"
                            className="sidebar-flyout-folder-sub"
                            aria-label={`New subfolder in ${folder.name}`}
                            title="New subfolder"
                            onClick={() => onCreateFolder(folder.id)}
                          >
                            +
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="sidebar-flyout-folder-delete"
                          aria-label={`Delete ${folder.name}`}
                          onClick={() => {
                            setRenamingFolderId(null)
                            setConfirmDeleteId(folder.id)
                          }}
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                  {node.children.map((child) => renderFolderNode(child, depth + 1))}
                </div>
              )
            }

            return (
              <div
                className="sidebar-folder-list"
                onDragOver={(event) => {
                  if (!Array.from(event.dataTransfer.types).includes('application/x-clarifi-folder')) return
                  event.preventDefault()
                }}
                onDrop={(event) => {
                  const sourceId = event.dataTransfer.getData('application/x-clarifi-folder')
                  if (!sourceId) return
                  event.preventDefault()
                  if (canReparentFolder(folders, sourceId, null)) {
                    onUpdateFolder(sourceId, { parentId: null })
                  }
                  setDragFolderId(null)
                  setDropTargetId(null)
                }}
              >
                {folderTree.map((node) => renderFolderNode(node, 0))}
              </div>
            )
          })()}

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
                draggable
                onDragStart={(event) => beginMeetingDrag(event, meeting.id, meeting.title)}
                onDragEnd={() => endMeetingDrag()}
                onClick={() => onSelectMeeting(meeting.id)}
                title="Drag onto a folder"
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
