import type { TranscriptEntry } from '../types/meeting'

type TranscriptPanelProps = {
  entries: TranscriptEntry[]
  activity: string
  live: boolean
}

export function TranscriptPanel({ entries, activity, live }: TranscriptPanelProps) {
  return (
    <section className="transcript-pane">
      <div className="pane-header">
        Transcript {live ? `· ${activity}` : ''}
      </div>
      <div className="transcript-scroll">
        {entries.length === 0 ? (
          <p className="transcript-empty">
            {live
              ? 'Listening for speech from your mic and meeting audio…'
              : 'No transcript captured for this meeting.'}
          </p>
        ) : (
          entries.map((entry) => (
            <p key={entry.id} className="transcript-line">
              <strong>{entry.speaker}</strong> {entry.text}
            </p>
          ))
        )}
      </div>
    </section>
  )
}
