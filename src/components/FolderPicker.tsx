import { useEffect, useMemo, useRef, useState } from 'react'

import { buildFolderTree } from '../../shared/folderAppearance'
import type { Folder } from '../types/meeting'
import { FolderGlyph } from './FolderGlyph'

type FolderPickerProps = {
  folders: Folder[]
  selectedFolderIds: string[]
  onChange: (folderIds: string[]) => void
  onRequestCreateFolder: () => void
  open: boolean
  onClose: () => void
  anchorLabel?: string
}

export function FolderPicker({
  folders,
  selectedFolderIds,
  onChange,
  onRequestCreateFolder,
  open,
  onClose,
  anchorLabel = 'Add to folder',
}: FolderPickerProps) {
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return folders
    return folders.filter((folder) => folder.name.toLowerCase().includes(q))
  }, [folders, query])

  const tree = useMemo(() => buildFolderTree(filtered), [filtered])

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  if (!open) return null

  const renderNodes = (nodes: ReturnType<typeof buildFolderTree<Folder>>, depth: number) =>
    nodes.map((folder) => {
      const checked = selectedFolderIds.includes(folder.id)
      return (
        <li key={folder.id}>
          <button
            type="button"
            className={`folder-picker-item${checked ? ' is-checked' : ''}`}
            style={{ paddingLeft: 10 + depth * 14 }}
            onClick={() => {
              const next = checked
                ? selectedFolderIds.filter((id) => id !== folder.id)
                : [...selectedFolderIds, folder.id]
              onChange(next)
            }}
          >
            <FolderGlyph icon={folder.icon} color={folder.color} size={14} />
            <span className="folder-picker-name">{folder.name}</span>
            {checked ? <span className="folder-picker-check" aria-hidden>✓</span> : null}
          </button>
          {folder.children.length > 0 ? (
            <ul className="folder-picker-list is-nested">
              {renderNodes(folder.children, depth + 1)}
            </ul>
          ) : null}
        </li>
      )
    })

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
        {query.trim()
          ? filtered.map((folder) => {
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
                    <FolderGlyph icon={folder.icon} color={folder.color} size={14} />
                    <span className="folder-picker-name">{folder.name}</span>
                    {checked ? <span className="folder-picker-check" aria-hidden>✓</span> : null}
                  </button>
                </li>
              )
            })
          : renderNodes(tree, 0)}
        {filtered.length === 0 ? <li className="folder-picker-empty">No folders match</li> : null}
      </ul>
      <button
        type="button"
        className="folder-picker-new"
        onClick={() => {
          onClose()
          onRequestCreateFolder()
        }}
      >
        + New folder
      </button>
    </div>
  )
}
