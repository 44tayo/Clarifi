import { useEffect, useMemo, useRef, useState } from 'react'

type TagPickerProps = {
  allTags: string[]
  selectedTags: string[]
  onChange: (tags: string[]) => void
  open: boolean
  onClose: () => void
}

/** Reuses the folder-picker visual pattern (search + checkable list + create-new row). */
export function TagPicker({ allTags, selectedTags, onChange, open, onClose }: TagPickerProps) {
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allTags
    return allTags.filter((tag) => tag.toLowerCase().includes(q))
  }, [allTags, query])

  const exactMatch = allTags.some((tag) => tag.toLowerCase() === query.trim().toLowerCase())

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose])

  if (!open) return null

  const toggle = (tag: string) => {
    const checked = selectedTags.some((t) => t.toLowerCase() === tag.toLowerCase())
    const next = checked
      ? selectedTags.filter((t) => t.toLowerCase() !== tag.toLowerCase())
      : [...selectedTags, tag]
    onChange(next)
  }

  return (
    <div className="folder-picker" ref={rootRef} role="dialog" aria-label="Tags">
      <div className="folder-picker-search">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search or create tag"
          aria-label="Search tags"
          autoFocus
          onKeyDown={(event) => {
            if (event.key === 'Enter' && query.trim() && !exactMatch) {
              event.preventDefault()
              toggle(query.trim())
              setQuery('')
            }
          }}
        />
      </div>
      <ul className="folder-picker-list">
        {filtered.map((tag) => {
          const checked = selectedTags.some((t) => t.toLowerCase() === tag.toLowerCase())
          return (
            <li key={tag}>
              <button
                type="button"
                className={`folder-picker-item${checked ? ' is-checked' : ''}`}
                onClick={() => toggle(tag)}
              >
                <span className="folder-picker-name">#{tag}</span>
                {checked ? (
                  <span className="folder-picker-check" aria-hidden>
                    ✓
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
        {filtered.length === 0 ? <li className="folder-picker-empty">No tags match</li> : null}
      </ul>
      {query.trim() && !exactMatch ? (
        <button
          type="button"
          className="folder-picker-new"
          onClick={() => {
            toggle(query.trim())
            setQuery('')
          }}
        >
          + Create “{query.trim()}”
        </button>
      ) : null}
    </div>
  )
}
