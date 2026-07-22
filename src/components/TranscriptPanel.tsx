import type { TranscriptEntry } from '../types/meeting'
import { speakerColor } from '../lib/speakerColors'

type TranscriptPanelProps = {
  entries: TranscriptEntry[]
  activity: string
  live: boolean
  speakerLabels?: Record<string, string>
}

function displaySpeaker(speaker: string, labels?: Record<string, string>): string {
  return labels?.[speaker]?.trim() || speaker
}

export function TranscriptPanel({ entries, activity, live, speakerLabels }: TranscriptPanelProps) {
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
              <span
                className="transcript-speaker-dot"
                style={{ background: speakerColor(entry.speaker) }}
              />
              <strong>{displaySpeaker(entry.speaker, speakerLabels)}</strong> {entry.text}
            </p>
          ))
        )}
      </div>
    </section>
  )
}
