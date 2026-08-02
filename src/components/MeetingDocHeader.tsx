import { useEffect, useRef, useState } from 'react'

import { StatefulButton } from './ui/StatefulButton'
import type { Meeting } from '../types/meeting'

type MeetingDocHeaderProps = {
  meeting: Meeting
  onTitleChange: (title: string) => void
  onShare: () => void
  onCopyLink: () => Promise<void>
  onExport: (format: 'markdown' | 'pdf') => void
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
  onShare,
  onCopyLink,
  onExport,
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
    <>
      {/* Sticky actions only — title scrolls with the document below. */}
      <div className="meeting-doc-chrome">
        <div className="meeting-doc-actions no-drag">
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
            className="meeting-doc-icon-btn meeting-doc-copy-link"
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
                  className="meeting-doc-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onExport('markdown')
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden
                    className="meeting-doc-menu-item-icon"
                  >
                    <path
                      d="M8 2.5v8M8 10.5 5 7.5M8 10.5l3-3"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M3 11v1.5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V11"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                  Export as Markdown
                </button>
                <button
                  type="button"
                  className="meeting-doc-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onExport('pdf')
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden
                    className="meeting-doc-menu-item-icon"
                  >
                    <path
                      d="M8 2.5v8M8 10.5 5 7.5M8 10.5l3-3"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M3 11v1.5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V11"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                  Export as PDF
                </button>
                <div className="meeting-doc-menu-divider" role="separator" />
                <button
                  type="button"
                  className="meeting-doc-menu-item is-danger"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onDelete()
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden
                    className="meeting-doc-menu-item-icon"
                  >
                    <path
                      d="M5.5 2.5h5M3 4.5h10M6.5 4.5V3.25A.75.75 0 0 1 7.25 2.5h1.5a.75.75 0 0 1 .75.75V4.5M12.5 4.5l-.55 8.05a1.25 1.25 0 0 1-1.25 1.2H5.3a1.25 1.25 0 0 1-1.25-1.2L3.5 4.5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6.75 7v4.5M9.25 7v4.5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                  Delete meeting
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <header className="meeting-doc-header">
        <input
          className="meeting-doc-title"
          value={meeting.title}
          onChange={(event) => onTitleChange(event.target.value)}
          aria-label="Meeting title"
        />
      </header>
    </>
  )
}
