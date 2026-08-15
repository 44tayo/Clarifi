import { useEffect, useId, useMemo, useRef, useState } from 'react'

import {
  DEFAULT_FOLDER_COLOR,
  DEFAULT_FOLDER_ICON,
  FOLDER_COLOR_IDS,
  FOLDER_COLORS,
  FOLDER_ICON_IDS,
  isFolderEmoji,
  isFolderIconId,
  type FolderColorId,
} from '../../shared/folderAppearance'
import { filterFolderEmojis } from '../lib/folderEmojis'
import { FolderGlyph } from './FolderGlyph'

export type FolderModalValues = {
  name: string
  color: FolderColorId
  /** Built-in icon id or emoji character. */
  icon: string
  parentId?: string | null
}

type CreateFolderModalProps = {
  open: boolean
  mode?: 'create' | 'edit'
  initial?: Partial<FolderModalValues>
  title?: string
  onClose: () => void
  onSubmit: (values: FolderModalValues) => void | Promise<void>
}

type AppearanceTab = 'icons' | 'emojis'

export function CreateFolderModal({
  open,
  mode = 'create',
  initial,
  title,
  onClose,
  onSubmit,
}: CreateFolderModalProps) {
  const titleId = useId()
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState<FolderColorId>(initial?.color ?? DEFAULT_FOLDER_COLOR)
  const [icon, setIcon] = useState<string>(initial?.icon ?? DEFAULT_FOLDER_ICON)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [tab, setTab] = useState<AppearanceTab>('icons')
  const [emojiQuery, setEmojiQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const emojiSearchRef = useRef<HTMLInputElement>(null)

  const filteredEmojis = useMemo(() => filterFolderEmojis(emojiQuery), [emojiQuery])

  useEffect(() => {
    if (!open) return
    const nextIcon = initial?.icon ?? DEFAULT_FOLDER_ICON
    setName(initial?.name ?? '')
    setColor(initial?.color ?? DEFAULT_FOLDER_COLOR)
    setIcon(nextIcon)
    setTab(isFolderEmoji(nextIcon) ? 'emojis' : 'icons')
    setEmojiQuery('')
    setPickerOpen(false)
    setBusy(false)
    const t = window.setTimeout(() => nameRef.current?.focus(), 40)
    return () => window.clearTimeout(t)
  }, [open, initial?.name, initial?.color, initial?.icon])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (pickerOpen) setPickerOpen(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, pickerOpen, onClose])

  useEffect(() => {
    if (!pickerOpen) return
    const onDoc = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [pickerOpen])

  useEffect(() => {
    if (!pickerOpen || tab !== 'emojis') return
    const t = window.setTimeout(() => emojiSearchRef.current?.focus(), 30)
    return () => window.clearTimeout(t)
  }, [pickerOpen, tab])

  if (!open) return null

  const canSubmit = name.trim().length > 0 && !busy
  const heading = title ?? (mode === 'edit' ? 'Edit folder' : 'Create folder')

  const submit = () => {
    if (!canSubmit) return
    setBusy(true)
    void Promise.resolve(
      onSubmit({
        name: name.trim(),
        color,
        icon: isFolderIconId(icon) || isFolderEmoji(icon) ? icon : DEFAULT_FOLDER_ICON,
        parentId: initial?.parentId ?? null,
      }),
    )
      .then(() => onClose())
      .finally(() => setBusy(false))
  }

  return (
    <div className="folder-modal-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="folder-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="folder-modal-header">
          <h2 id={titleId}>{heading}</h2>
          <button type="button" className="folder-modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <label className="folder-modal-label" htmlFor="folder-modal-name">
          Name and icon
        </label>
        <div className="folder-modal-name-row">
          <div className="folder-modal-icon-wrap" ref={pickerRef}>
            <button
              type="button"
              className="folder-modal-icon-btn"
              aria-label="Choose icon and color"
              aria-expanded={pickerOpen}
              onClick={() => setPickerOpen((v) => !v)}
            >
              <FolderGlyph icon={icon} color={color} size={20} />
            </button>
            {pickerOpen ? (
              <div className="folder-appearance-popover" role="dialog" aria-label="Folder appearance">
                <div className="folder-appearance-colors" role="listbox" aria-label="Colors">
                  {FOLDER_COLOR_IDS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      role="option"
                      aria-selected={color === id}
                      className={`folder-color-swatch${color === id ? ' is-selected' : ''}`}
                      style={{ background: FOLDER_COLORS[id] }}
                      onClick={() => setColor(id)}
                      title={id}
                    />
                  ))}
                </div>

                <div className="folder-appearance-tabs" role="tablist" aria-label="Icon type">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'icons'}
                    className={`folder-appearance-tab${tab === 'icons' ? ' is-active' : ''}`}
                    onClick={() => setTab('icons')}
                  >
                    Icons
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'emojis'}
                    className={`folder-appearance-tab${tab === 'emojis' ? ' is-active' : ''}`}
                    onClick={() => setTab('emojis')}
                  >
                    Emojis
                  </button>
                </div>

                {tab === 'icons' ? (
                  <div className="folder-appearance-icons" role="listbox" aria-label="Icons">
                    {FOLDER_ICON_IDS.map((id) => (
                      <button
                        key={id}
                        type="button"
                        role="option"
                        aria-selected={icon === id}
                        className={`folder-icon-option${icon === id ? ' is-selected' : ''}`}
                        onClick={() => setIcon(id)}
                        title={id}
                      >
                        <FolderGlyph icon={id} color={color} size={18} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="folder-appearance-emoji-panel">
                    <input
                      ref={emojiSearchRef}
                      className="folder-appearance-emoji-search"
                      value={emojiQuery}
                      onChange={(event) => setEmojiQuery(event.target.value)}
                      placeholder="Search emoji"
                      aria-label="Search emoji"
                    />
                    <div className="folder-appearance-emojis" role="listbox" aria-label="Emojis">
                      {filteredEmojis.map((entry) => (
                        <button
                          key={entry.emoji}
                          type="button"
                          role="option"
                          aria-selected={icon === entry.emoji}
                          className={`folder-emoji-option${icon === entry.emoji ? ' is-selected' : ''}`}
                          onClick={() => setIcon(entry.emoji)}
                          title={entry.labels}
                        >
                          {entry.emoji}
                        </button>
                      ))}
                      {filteredEmojis.length === 0 ? (
                        <p className="folder-appearance-emoji-empty">No matches</p>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <input
            id="folder-modal-name"
            ref={nameRef}
            className="folder-modal-name-input"
            value={name}
            placeholder="Name"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submit()
              }
            }}
          />
        </div>

        <footer className="folder-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSubmit}
            onClick={submit}
          >
            {mode === 'edit' ? 'Save' : 'Create'}
          </button>
        </footer>
      </div>
    </div>
  )
}
