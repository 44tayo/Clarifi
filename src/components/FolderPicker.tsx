import { useEffect, useMemo, useRef, useState } from 'react'

import type { Folder } from '../types/meeting'

type FolderPickerProps = {
  folders: Folder[]
  selectedFolderIds: string[]
  onChange: (folderIds: string[]) => void
  onCreateFolder: (name: string) => Promise<Folder | void> | Folder | void
  open: boolean
  onClose: () => void
  anchorLabel?: string
}

export function FolderPicker({
  folders,
  selectedFolderIds,
  onChange,
  onCreateFolder,
  open,
  onClose,
  anchorLabel = 'Add to folder',
}: FolderPickerProps) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return folders
    return folders.filter((folder) => folder.name.toLowerCase().includes(q))
  }, [folders, query])

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="folder-picker" ref={rootRef} role="dialog" aria-label={anchorLabel}>
      <div className="folder-picker-search">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          aria-label="Search folders"
          autoFocus
        />
      </div>
      <ul className="folder-picker-list">
        {filtered.map((folder) => {
          const checked = selectedFolderIds.includes(folder.id)
          return (
            <li key={folder.id}>
              <button
                type="button"
                className={`folder-picker-item${checked ? ' is-checked' : ''}`}
                onClick={() => {
                  const next = checked
                    ? selectedFolderIds.filter((id) => id !== folder.id)
                    : [...selectedFolderIds, folder.id]
                  onChange(next)
                }}
              >
                <span className="folder-picker-name">{folder.name}</span>
                {checked ? <span className="folder-picker-check" aria-hidden>✓</span> : null}
              </button>
            </li>
          )
        })}
        {filtered.length === 0 ? (
          <li className="folder-picker-empty">No folders match</li>
        ) : null}
      </ul>
      <button
        type="button"
        className="folder-picker-new"
        disabled={creating}
        onClick={() => {
          const name = window.prompt('Folder name', query.trim() || 'New folder')
          if (!name?.trim()) return
          setCreating(true)
          void Promise.resolve(onCreateFolder(name.trim())).finally(() => setCreating(false))
        }}
      >
        + New folder
      </button>
    </div>
  )
}
