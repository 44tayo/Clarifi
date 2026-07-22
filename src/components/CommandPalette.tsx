import { useEffect, useMemo, useRef, useState } from 'react'

import { buildCommandActions, type CommandAction } from '../lib/commandPalette'
import type { Meeting } from '../types/meeting'

type CommandPaletteProps = {
  open: boolean
  meetings: Meeting[]
  onClose: () => void
  onNavigate: (actionId: string) => void
  onOpenMeeting: (meetingId: string) => void
}

export function CommandPalette({
  open,
  meetings,
  onClose,
  onNavigate,
  onOpenMeeting,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const actions = useMemo(
    () => buildCommandActions(meetings, query),
    [meetings, query],
  )

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
    const id = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, Math.max(actions.length - 1, 0)))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        const action = actions[activeIndex]
        if (action) runAction(action)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, actions, activeIndex, onClose])

  const runAction = (action: CommandAction) => {
    if (action.meetingId) {
      onOpenMeeting(action.meetingId)
    } else {
      onNavigate(action.id)
    }
    onClose()
  }

  if (!open) return null

  let lastGroup = ''

  return (
    <div className="command-palette-backdrop" role="presentation" onClick={onClose}>
      <div
        className="command-palette"
        role="dialog"
        aria-label="Search"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="command-palette-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search meetings and navigate…"
          aria-autocomplete="list"
          aria-controls="command-palette-list"
        />
        <div id="command-palette-list" className="command-palette-list" role="listbox">
          {actions.length === 0 ? (
            <p className="command-palette-empty">No matches</p>
          ) : (
            actions.map((action, index) => {
              const showGroup = action.group !== lastGroup
              lastGroup = action.group
              return (
                <div key={action.id}>
                  {showGroup ? (
                    <div className="command-palette-group">{action.group}</div>
                  ) : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`command-palette-item${index === activeIndex ? ' is-active' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => runAction(action)}
                  >
                    {action.label}
                  </button>
                </div>
              )
            })
          )}
        </div>
        <div className="command-palette-footer">
          <span>↑↓ to move</span>
          <span>↵ to open</span>
          <span>esc to close</span>
        </div>
      </div>
    </div>
  )
}
