'use client'

import './screen-share-assist-mock.css'

type SheetRow = {
  name: string
  amount: string
  cost: string
  app: boolean
  tone: 'green' | 'amber' | 'red'
  strike?: boolean
}

const SHEET_ROWS: SheetRow[] = [
  { name: 'Agnes Scott College', amount: 'up to $25k, full ride*', cost: '$58,000', app: true, tone: 'green' },
  { name: 'Baylor University', amount: '$12k–$23k, full tuition+, full ride*', cost: '$64,000', app: true, tone: 'green' },
  { name: 'Davidson College', amount: '$20k, full ride*', cost: '$70,000', app: true, tone: 'green' },
  { name: 'Duke University', amount: 'full ride*', cost: '$75,000', app: true, tone: 'red' },
  { name: 'Emory University', amount: 'up to a full ride*', cost: '$69,000', app: true, tone: 'green' },
  { name: 'Georgia Tech', amount: 'full ride*', cost: '$46,000', app: true, tone: 'amber', strike: true },
  { name: 'Hendrix College', amount: '$15k upwards, full ride*', cost: '$62,000', app: true, tone: 'green' },
  { name: 'Indiana University Bloomington', amount: '$1k–$11k, full ride*', cost: '$50,000', app: true, tone: 'green' },
  { name: 'Sewanee: University of the South', amount: '$5k–$26k, $30k, full ride*', cost: '$64,000', app: false, tone: 'green' },
  { name: 'University of Alabama', amount: '$6k full tuition + $2.5k engineering*', cost: '$45,000', app: true, tone: 'green' },
  { name: 'University of Georgia', amount: '$9.5k–$24k, full tuition*', cost: '$41,000', app: true, tone: 'green' },
  { name: 'University of Miami', amount: 'up to $28k, full ride*', cost: '$69,000', app: true, tone: 'green' },
  { name: 'University of Michigan Ann Arbor', amount: '$20k*, $25k–$30k*', cost: '$64,000', app: true, tone: 'amber' },
  { name: 'University of North Carolina Chapel Hill', amount: 'full ride*', cost: '$48,000', app: true, tone: 'green' },
  { name: 'University of Rhode Island', amount: '$1.5k–$15k, full ride*', cost: '$47,000', app: true, tone: 'green' },
  { name: 'University of Richmond', amount: '½ tuition, full ride*', cost: '$73,000', app: true, tone: 'green' },
]

const COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const

const STEPS = [
  'Click cell B1, then press ⌘ + → to jump to the last filled column.',
  'Select column B and open Format ▸ Conditional formatting to color the amounts.',
  'Use Data ▸ Create a filter, then sort “Direct Cost” high → low.',
] as const

function ScreenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  )
}

function StealthIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function FollowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  )
}

export function ScreenShareAssistMock() {
  return (
    <div className="ssa-root" aria-hidden>
      <div className="ssa-app">
        <div className="ssa-sheet-titlebar">
          <span className="ssa-sheet-logo">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
                fill="#0f9d58"
              />
              <path d="M14 2v6h6z" fill="#0c8043" />
              <path d="M8 12h8v1.4H8zm0 2.6h8V16H8zm0 2.6h8v1.4H8z" fill="#fff" />
              <path d="M11 11.3h1.4v8H11z" fill="#fff" />
            </svg>
          </span>
          <div className="ssa-sheet-titlewrap">
            <span className="ssa-sheet-title">SCHOLARSHIP - INTL STUDENT (International Merit Scholarships)</span>
            <div className="ssa-sheet-menubar">
              <span>File</span>
              <span>Edit</span>
              <span>View</span>
              <span>Insert</span>
              <span>Format</span>
              <span>Data</span>
              <span>Tools</span>
              <span>Extensions</span>
              <span>Help</span>
            </div>
          </div>
          <span className="ssa-sheet-share">Share</span>
          <span className="ssa-sheet-avatar">T</span>
        </div>

        <div className="ssa-sheet-toolbar">
          <span className="ssa-tb-zoom">100%</span>
          <span className="ssa-tb-sep" />
          <span className="ssa-tb-glyph ssa-tb-money">$</span>
          <span className="ssa-tb-glyph">%</span>
          <span className="ssa-tb-sep" />
          <span className="ssa-tb-glyph ssa-tb-bold">B</span>
          <span className="ssa-tb-glyph ssa-tb-italic">I</span>
          <span className="ssa-tb-sep" />
          <span className="ssa-tb-viewonly">👁 View only</span>
        </div>

        <div className="ssa-formula-bar">
          <span className="ssa-cell-ref">B1</span>
          <span className="ssa-fx">fx</span>
          <span className="ssa-formula-val">Amount</span>
        </div>

        <div className="ssa-grid">
          <div className="ssa-col-headers">
            <span className="ssa-corner" />
            {COL_LETTERS.map((letter, i) => (
              <span key={letter} className={`ssa-col-letter${i === 1 ? ' sel' : ''}`}>
                {letter}
              </span>
            ))}
          </div>

          <div className="ssa-grid-row ssa-grid-headrow">
            <span className="ssa-row-num">1</span>
            <span className="ssa-gc ssa-gc-name head">Institution</span>
            <span className="ssa-gc ssa-gc-amount head sel">Amount</span>
            <span className="ssa-gc ssa-gc-cost head">Direct Cost</span>
            <span className="ssa-gc ssa-gc-app head">Requires App</span>
            <span className="ssa-gc ssa-gc-blank" />
            <span className="ssa-gc ssa-gc-blank" />
            <span className="ssa-gc ssa-gc-blank" />
          </div>

          {SHEET_ROWS.map((row, i) => (
            <div key={row.name} className="ssa-grid-row">
              <span className="ssa-row-num">{i + 2}</span>
              <span className={`ssa-gc ssa-gc-name${row.strike ? ' strike' : ''}`}>{row.name}</span>
              <span className={`ssa-gc ssa-gc-amount tone-${row.tone}${row.strike ? ' strike' : ''}`}>
                {row.amount}
              </span>
              <span className="ssa-gc ssa-gc-cost">{row.cost}</span>
              <span className="ssa-gc ssa-gc-app">
                <span className={`ssa-bool ${row.app ? 'true' : 'false'}`}>{row.app ? 'TRUE' : 'FALSE'}</span>
              </span>
              <span className="ssa-gc ssa-gc-blank" />
              <span className="ssa-gc ssa-gc-blank" />
              <span className="ssa-gc ssa-gc-blank" />
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
            <span className="ssa-tool-icon active" aria-hidden>
              <ScreenIcon />
            </span>
            <span className="ssa-tool-icon stealth" aria-hidden>
              <StealthIcon />
            </span>
            <span className="ssa-tool-icon" aria-hidden>
              <FollowIcon />
            </span>
          </div>
          <div className="ssa-tool-divider" />
          <div className="ssa-toolbar-right">
            <span className="ssa-tool-icon dictation" aria-hidden>
              <MicIcon />
            </span>
            <span className="ssa-tool-icon" aria-hidden>
              <span className="ssa-wave">
                <span />
                <span />
                <span />
                <span />
              </span>
            </span>
            <span className="ssa-tool-history">
              History
              <span className="ssa-tool-chev">▼</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
