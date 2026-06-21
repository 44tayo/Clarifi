import './dictation-pill-mock.css'

export default function DictationPillMock() {
  return (
    <div className="dpm-scene" aria-hidden>
      <div className="dpm-app-window">
        <div className="dpm-app-chrome">
          <span className="dpm-dot r" />
          <span className="dpm-dot y" />
          <span className="dpm-dot g" />
          <span className="dpm-app-title">Notes — Q4 planning</span>
        </div>
        <div className="dpm-app-body">
          <p>Action items from today&apos;s sync:</p>
          <p className="dpm-typed">
            Ship the pilot by Friday and send the security doc to procurement.
            <span className="dpm-cursor" />
          </p>
        </div>
      </div>

      <div className="dpm-pill-layer">
        <div className="dpm-fn-hint">Hold Fn</div>
        <div className="dpm-pill dpm-pill-recording">
          <span className="dpm-pill-x">×</span>
          <div className="dpm-waveform">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
          <span className="dpm-pill-check">✓</span>
        </div>
      </div>
    </div>
  )
}
