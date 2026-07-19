import { useEffect, useState } from 'react'

type NotesEditorProps = {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
}

export function NotesEditor({ value, onChange, readOnly }: NotesEditorProps) {
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
    <section className="editor-pane">
      <div className="pane-header">Your notes</div>
      <textarea
        className="notes-editor"
        value={draft}
        readOnly={readOnly}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Jot down the important bits during the call — Clarifi will combine these with the transcript after."
      />
    </section>
  )
}
