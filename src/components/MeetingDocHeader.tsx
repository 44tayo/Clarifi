import { useEffect, useRef, useState } from 'react'

import { StatefulButton } from './ui/StatefulButton'
import type { Meeting } from '../types/meeting'

type MeetingDocHeaderProps = {
  meeting: Meeting
  onTitleChange: (title: string) => void
  onBackHome: () => void
  onShare: () => void
  onCopyLink: () => Promise<void>
  onToggleMaximize: () => void
  isMaximized: boolean
  onDelete: () => void
  /** True only after at least one person has been invited (not merely link published). */
  hasSharedWithPeople?: boolean
}

function ShareNodesIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  )
}

/** Shared-with-me style: two people silhouettes. */
function SharedPeopleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="6" cy="5.5" r="2.2" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M2.2 12.5c.5-2.2 2-3.4 3.8-3.4s3.3 1.2 3.8 3.4"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <circle cx="11.2" cy="6" r="1.8" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M9.6 12.5c.35-1.5 1.4-2.4 2.7-2.4 1.1 0 2 .6 2.5 1.7"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function MeetingDocHeader({
  meeting,
  onTitleChange,
  onBackHome,
  onShare,
  onCopyLink,
  onToggleMaximize,
  isMaximized,
  onDelete,
  hasSharedWithPeople = false,
}: MeetingDocHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <header className="meeting-doc-header">
      <div className="meeting-doc-top">
        <div className="meeting-doc-nav">
          <button
            type="button"
            className="meeting-doc-icon-btn meeting-doc-back"
            onClick={onBackHome}
            aria-label="Back to home"
            title="Back to home"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M10 3.5 5.5 8 10 12.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M2.5 7.2 8 2.5l5.5 4.7V13a1 1 0 0 1-1 1H9.2V9.8H6.8V14H3.5a1 1 0 0 1-1-1V7.2Z"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="meeting-doc-actions">
          <button
            type="button"
            className={`meeting-doc-share-pill${hasSharedWithPeople ? ' is-shared' : ''}`}
            onClick={onShare}
          >
            {hasSharedWithPeople ? <SharedPeopleIcon /> : <ShareNodesIcon />}
            {hasSharedWithPeople ? 'Shared' : 'Share'}
          </button>

          <StatefulButton
            variant="ghost"
            iconOnly
            idleLabel=""
            successLabel=""
            successDuration={1600}
            className="meeting-doc-icon-btn"
            aria-label="Copy share link"
            title="Copy share link"
            icon={
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l1.8-1.8a2.6 2.6 0 1 0-3.7-3.7L7.8 4.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M9.2 6.8a2.6 2.6 0 0 0-3.7 0L3.7 8.6a2.6 2.6 0 1 0 3.7 3.7l.8-.8"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            }
            onClick={onCopyLink}
          />

          <button
            type="button"
            className="meeting-doc-icon-btn"
            onClick={onToggleMaximize}
            aria-label={isMaximized ? 'Exit focus mode' : 'Maximize note'}
            title={isMaximized ? 'Exit focus mode' : 'Maximize note'}
            aria-pressed={isMaximized}
          >
            {isMaximized ? (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M6 3H3v3M10 3h3v3M6 13H3v-3M10 13h3v-3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M9.5 3H13v3.5M6.5 13H3V9.5M13 9.5V13H9.5M3 6.5V3h3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>

          <div className="meeting-doc-menu" ref={menuRef}>
            <button
              type="button"
              className="meeting-doc-icon-btn"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="More actions"
              aria-expanded={menuOpen}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                <circle cx="3.5" cy="8" r="1.2" fill="currentColor" />
                <circle cx="8" cy="8" r="1.2" fill="currentColor" />
                <circle cx="12.5" cy="8" r="1.2" fill="currentColor" />
              </svg>
            </button>
            {menuOpen ? (
              <div className="meeting-doc-menu-popover" role="menu">
                <button
                  type="button"
                  className="meeting-doc-menu-item is-danger"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onDelete()
                  }}
                >
                  Delete meeting
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <input
        className="meeting-doc-title"
        value={meeting.title}
        onChange={(event) => onTitleChange(event.target.value)}
        aria-label="Meeting title"
      />
    </header>
  )
}
