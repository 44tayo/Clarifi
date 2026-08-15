'use client'

import './share-privacy-stage.css'

const STAGE_BG =
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1600&q=80'

/**
 * Marketing stage: private Clarifi recap + explicit share overlay.
 * Peer pattern (Granola privacy/share block); Clarifi product chrome and copy.
 */
export function HowItWorksSection() {
  return (
    <section className="sns-section" id="how-it-works" data-reveal aria-label="Private notes, ready to share">
      <header className="sns-intro">
        <h2 className="sns-intro-title">Private by default, ready to share</h2>
        <p className="sns-intro-copy">
          Recaps stay with you until you decide otherwise. Search them, polish them, then share a
          summary or follow-up with people you choose—nothing goes out automatically.
        </p>
      </header>

      <div className="sns-stage">
        <div
          className="sns-stage-bg"
          style={{ backgroundImage: `url(${STAGE_BG})` }}
          aria-hidden
        />

        <div className="sns-window" aria-hidden>
          <div className="sns-window-chrome">
            <div className="sns-traffic">
              <span />
              <span />
              <span />
            </div>
            <div className="sns-chrome-actions">
              <span className="sns-chrome-icon" />
              <span className="sns-chrome-icon" />
              <span className="sns-share-btn">Share</span>
              <span className="sns-chrome-icon" />
            </div>
          </div>

          <div className="sns-window-body">
            <h3 className="sns-doc-title">Acme Corp — Pilot Kickoff</h3>
            <div className="sns-meta">
              <span className="sns-pill">Notes</span>
              <span className="sns-pill sns-pill--accent">Enhanced</span>
              <span className="sns-pill">Fri, Mar 14</span>
            </div>

            <p className="sns-section-label"># Decisions &amp; next steps</p>
            <ul className="sns-bullets">
              <li>Agreed on a 2-week pilot starting next Monday.</li>
              <li>Send security one-pager to procurement before sign-off.</li>
              <li>Schedule decision call for Friday at 2pm PT.</li>
              <li>Clarifi sends updated timeline and scope by EOD.</li>
            </ul>
          </div>
        </div>

        <aside className="sns-share" aria-hidden>
          <p className="sns-share-title">Share notes</p>
          <div className="sns-share-group">Internal participants</div>
          <ul className="sns-people">
            <li className="sns-person">
              <span className="sns-avatar sns-avatar--green">S</span>
              <div className="sns-person-meta">
                <strong>Sam</strong>
                <span>sam@acme.so</span>
              </div>
            </li>
            <li className="sns-person">
              <span className="sns-avatar sns-avatar--orange">M</span>
              <div className="sns-person-meta">
                <strong>Maya</strong>
                <span>maya@acme.so</span>
              </div>
            </li>
            <li className="sns-person">
              <span className="sns-avatar sns-avatar--blue">A</span>
              <div className="sns-person-meta">
                <strong>Alex</strong>
                <span>alex@acme.so</span>
              </div>
            </li>
          </ul>
        </aside>
      </div>
    </section>
  )
}
