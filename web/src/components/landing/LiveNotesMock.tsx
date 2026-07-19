const USER_NOTES = ['pilot — 2 weeks', 'send security doc', 'follow-up Fri']

const ENHANCED_LINES = [
  'Agreed on a two-week pilot before full rollout.',
  'Action item: send the security one-pager to procurement.',
  'Follow-up call scheduled for Friday at 2pm.',
]

export function LiveNotesMock() {
  return (
    <div className="landing-notes-window">
      <p className="landing-notes-meta">While you type…</p>
      <p className="landing-notes-title">Your quick notes</p>
      <ul className="participants-feature-list" style={{ padding: 0, margin: '4px 0 12px' }}>
        {USER_NOTES.map((note) => (
          <li key={note} className="landing-transcript-line">
            <strong>·</strong> {note}
          </li>
        ))}
      </ul>
      <p className="landing-notes-meta">After you hang up…</p>
      <p className="landing-notes-title">Polished notes</p>
      {ENHANCED_LINES.map((line) => (
        <p key={line} className="landing-transcript-line">
          {line}
        </p>
      ))}
    </div>
  )
}
