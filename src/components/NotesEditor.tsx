import { useEffect, useState } from 'react'

type NotesEditorProps = {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  label?: string
  hint?: string
  placeholder?: string
  hideHeader?: boolean
}

export function NotesEditor({
  value,
  onChange,
  readOnly,
  label = 'Scratchpad',
  hint,
  placeholder = 'Write private notes...',
  hideHeader = false,
}: NotesEditorProps) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (readOnly || draft === value) return
    const timer = window.setTimeout(() => onChange(draft), 400)
    return () => window.clearTimeout(timer)
  }, [draft, value, onChange, readOnly])

  return (
    <section className={`editor-pane${hideHeader ? ' is-bare' : ''}`}>
      {!hideHeader ? <div className="pane-header">{label}</div> : null}
      {hint ? <p className="pane-hint">{hint}</p> : null}
      <textarea
        className="notes-editor"
        value={draft}
        readOnly={readOnly}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
      />
    </section>
  )
}
