'use client'

import './gmail-dictation-mock.css'

export function GmailDictationMock() {
  return (
    <div className="gdm-scene" aria-hidden>
      <div className="gdm-window">
        <div className="gdm-chrome">
          <div className="gdm-traffic">
            <span className="r" />
            <span className="y" />
            <span className="g" />
          </div>
          <div className="gdm-chrome-title">
            <span className="gdm-gmail-icon">M</span>
            <span>Reply</span>
            <span className="gdm-chrome-meta">— alex@company.com</span>
          </div>
        </div>

        <div className="gdm-compose">
          <div className="gdm-field-row">
            <span className="gdm-field-label">To</span>
            <span className="gdm-field-value">Alex Chen</span>
          </div>

          <div className="gdm-quoted">
            <div className="gdm-quoted-from">Alex · Tue 2:14 PM</div>
            <div>
              Can we move the pilot kickoff to next Friday? Procurement wants one more security
              review before we sign.
            </div>
          </div>

          <div className="gdm-reply">
            <p>Hi Alex — Friday works on our end. I&apos;ll send the updated timeline and pilot scope by EOD today.</p>
            <p className="gdm-reply-live">
              <span className="gdm-dictated-text">
                Let me know if 2pm PT still works for kickoff.
              </span>
              <span className="gdm-cursor" />
            </p>
          </div>

          <div className="gdm-footer">
            <span className="gdm-send">Send</span>
          </div>
        </div>
      </div>

      <div className="gdm-pill-stage">
        <div className="gdm-fn-badge">Hold Fn (Globe)</div>
        <div className="gdm-pill gdm-pill-idle" />
        <div className="gdm-pill gdm-pill-recording">
          <span className="gdm-pill-btn">×</span>
          <div className="gdm-pill-wave">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
          <span className="gdm-pill-btn gdm-pill-check">✓</span>
        </div>
        <div className="gdm-pill gdm-pill-processing">
          <span className="gdm-pill-spinner" />
        </div>
      </div>
    </div>
  )
}
