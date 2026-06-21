'use client'

import './screen-share-assist-mock.css'

const DEAL_ROWS: Array<{
  account: string
  stage: string
  close: string
  owner: string
  highlight?: boolean
}> = [
  { account: 'Northwind Labs', stage: 'Discovery', close: 'Apr 12', owner: 'Sam' },
  { account: 'Acme Corp', stage: 'Proposal', close: 'Mar 28', owner: 'You', highlight: true },
  { account: 'Brightpath', stage: 'Negotiation', close: 'Apr 3', owner: 'Jordan' },
]

const STEPS = [
  'Reference the 2-week pilot you offered on the Acme deal.',
  'Ask who signs off on procurement after their security review.',
  'Propose Friday at 2pm PT for a decision call.',
] as const

function ScreenIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  )
}

export function ScreenShareAssistMock() {
  return (
    <div className="ssa-root" aria-hidden>
      <div className="ssa-app">
        <div className="ssa-app-chrome">
          <div className="ssa-traffic">
            <span className="r" />
            <span className="y" />
            <span className="g" />
          </div>
          <span className="ssa-app-title">Acme Corp — Negotiation</span>
          <span className="ssa-app-badge">CRM</span>
        </div>

        <div className="ssa-deal-meta">
          <div className="ssa-meta-item">
            <span className="ssa-meta-label">Stage</span>
            <span className="ssa-meta-value">Proposal</span>
          </div>
          <div className="ssa-meta-item">
            <span className="ssa-meta-label">Close date</span>
            <span className="ssa-meta-value">Mar 28</span>
          </div>
          <div className="ssa-meta-item">
            <span className="ssa-meta-label">Owner</span>
            <span className="ssa-meta-value">You</span>
          </div>
        </div>

        <div className="ssa-table">
          <div className="ssa-table-head">
            <span>Account</span>
            <span>Stage</span>
            <span>Close</span>
            <span>Owner</span>
          </div>
          {DEAL_ROWS.map((row) => (
            <div key={row.account} className={`ssa-table-row${row.highlight ? ' highlight' : ''}`}>
              <span className="ssa-cell-main">{row.account}</span>
              <span>
                <span className={`ssa-pill${row.highlight ? ' green' : ''}`}>{row.stage}</span>
              </span>
              <span>{row.close}</span>
              <span>{row.owner}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ssa-overlay">
        <div className="ssa-overlay-body">
          <p className="ssa-viewed-label">Viewed screen</p>
          <ol className="ssa-steps">
            {STEPS.map((step, i) => (
              <li key={step} className="ssa-step">
                <span className="ssa-step-num">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="ssa-toolbar">
          <div className="ssa-toolbar-left">
            <span className="ssa-status-dot" />
            <span className="ssa-brand">Clarifi</span>
            <span className="ssa-mode-pill">General</span>
          </div>
          <div className="ssa-toolbar-right">
            <span className="ssa-icon muted" aria-hidden>
              <MicIcon />
            </span>
            <span className="ssa-sep" />
            <span className="ssa-icon active" aria-hidden>
              <ScreenIcon />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
