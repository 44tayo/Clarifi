type SidebarToggleProps = {
  expanded: boolean
  onToggle: () => void
  className?: string
}

/** Granola-style sidebar show/hide control — same button open or closed. */
export function SidebarToggle({ expanded, onToggle, className = '' }: SidebarToggleProps) {
  const label = expanded ? 'Hide sidebar' : 'Show sidebar'
  return (
    <button
      type="button"
      className={`sidebar-toggle no-drag${className ? ` ${className}` : ''}`}
      aria-label={label}
      title={`${label} (⌘S)`}
      aria-pressed={expanded}
      onClick={onToggle}
    >
      <span className={`sidebar-toggle-icon${expanded ? ' is-expanded' : ''}`} aria-hidden>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M10 3.5 5.5 8 10 12.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  )
}
