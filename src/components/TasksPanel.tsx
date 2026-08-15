import { useMemo, useState } from 'react'

import type { Meeting } from '../types/meeting'

type TasksPanelProps = {
  meeting: Meeting
  onToggle: (item: string, completed: boolean) => void
  onAdd: (item: string) => void
}

export function TasksPanel({ meeting, onToggle, onAdd }: TasksPanelProps) {
  const [draft, setDraft] = useState('')
  const completed = useMemo(
    () => new Set(meeting.completedActionItems ?? []),
    [meeting.completedActionItems],
  )
  const items = meeting.actionItems ?? []

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    onAdd(text)
    setDraft('')
  }

  return (
    <section className="enhanced-panel artifact-tasks-panel">
      {items.length === 0 ? (
        <p className="artifact-empty">No tasks yet. Add one below, or regenerate the AI summary.</p>
      ) : (
        <ul className="artifact-task-list">
          {items.map((item) => {
            const done = completed.has(item)
            return (
              <li key={item} className={`artifact-task-row${done ? ' is-done' : ''}`}>
                <label className="artifact-task-label">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={(event) => onToggle(item, event.target.checked)}
                  />
                  <span>{item}</span>
                </label>
              </li>
            )
          })}
        </ul>
      )}

      <div className="artifact-task-add">
        <input
          type="text"
          className="artifact-task-input"
          placeholder="Add a task…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
        />
        <button type="button" className="btn btn-secondary" onClick={submit} disabled={!draft.trim()}>
          Add
        </button>
      </div>
    </section>
  )
}
