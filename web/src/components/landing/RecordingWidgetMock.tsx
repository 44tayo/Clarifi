'use client'

import './recording-widget-mock.css'

/** Static marketing mock of the Clarifi recording pill + scratchpad. */
export function RecordingWidgetMock() {
  return (
    <div className="recording-widget-mock" aria-hidden>
      <div className="recording-widget-mock-pill">
        <span className="recording-widget-mock-dot" />
        <span className="recording-widget-mock-timer">12:48</span>
        <span className="recording-widget-mock-title">Weekly team sync</span>
        <span className="recording-widget-mock-stop">Stop</span>
      </div>
      <div className="recording-widget-mock-pad">
        <p className="recording-widget-mock-label">Scratchpad</p>
        <p className="recording-widget-mock-line">pilot — 2 weeks</p>
        <p className="recording-widget-mock-line">send security doc</p>
        <p className="recording-widget-mock-line is-muted">Type a note…</p>
      </div>
    </div>
  )
}
