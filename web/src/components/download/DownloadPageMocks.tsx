import type { ReactNode } from 'react'

import { MAC_QUARANTINE_COMMAND } from '@/lib/downloads'

function MediaFrame({ children, variant = 'mac' }: { children: ReactNode; variant?: 'mac' | 'win' }) {
  return (
    <div className={`dh-media-frame${variant === 'win' ? ' win' : ''}`} aria-hidden>
      <div className="dh-media-frame-inner">{children}</div>
    </div>
  )
}

export function DamagedDialogMock() {
  return (
    <MediaFrame>
      <div className="dh-macos-sheet">
        <div className="dh-macos-sheet-icon warn" aria-hidden>
          ⚠
        </div>
        <p className="dh-macos-sheet-title">
          &ldquo;Clarifi&rdquo; is damaged and can&apos;t be opened. You should move it to the Trash.
        </p>
        <p className="dh-macos-sheet-meta">Chrome downloaded this file today.</p>
        <div className="dh-macos-sheet-actions stacked">
          <span className="dh-macos-sheet-btn primary">Move to Trash</span>
          <span className="dh-macos-sheet-btn">Cancel</span>
        </div>
      </div>
    </MediaFrame>
  )
}

export function TerminalMock() {
  return (
    <MediaFrame>
      <div className="dh-terminal-window">
        <div className="dh-terminal-titlebar">
          <span className="dh-terminal-dot r" />
          <span className="dh-terminal-dot y" />
          <span className="dh-terminal-dot g" />
          <span className="dh-terminal-title">Terminal — zsh</span>
        </div>
        <div className="dh-terminal-body">
          <p className="dh-terminal-line muted">Last login: today on console</p>
          <p className="dh-terminal-line">
            <span className="dh-terminal-prompt">you@MacBook-Air ~ %</span> {MAC_QUARANTINE_COMMAND}
          </p>
          <p className="dh-terminal-line">
            <span className="dh-terminal-prompt">you@MacBook-Air ~ %</span>
            <span className="dh-terminal-cursor" />
          </p>
        </div>
      </div>
    </MediaFrame>
  )
}

export function AccessibilityDialogMock() {
  return (
    <MediaFrame>
      <div className="dh-macos-sheet wide">
        <p className="dh-macos-sheet-kicker">Accessibility Access</p>
        <div className="dh-macos-a11y-row">
          <div className="dh-macos-a11y-icon" aria-hidden>
            <span className="dh-macos-lock">🔒</span>
          </div>
          <div className="dh-macos-a11y-copy">
            <p className="dh-macos-sheet-title left">
              &ldquo;Clarifi&rdquo; would like to control this computer using accessibility features.
            </p>
            <p className="dh-macos-sheet-meta left">
              Grant access to this application in Privacy &amp; Security settings, located in System
              Settings.
            </p>
          </div>
        </div>
        <div className="dh-macos-sheet-actions end">
          <span className="dh-macos-sheet-btn icon">?</span>
          <span className="dh-macos-sheet-btn primary">Open System Settings</span>
          <span className="dh-macos-sheet-btn">Deny</span>
        </div>
      </div>
    </MediaFrame>
  )
}

export function SmartScreenMock() {
  return (
    <MediaFrame variant="win">
      <div className="dh-win-dialog">
        <div className="dh-win-dialog-icon" aria-hidden>
          🛡
        </div>
        <p className="dh-win-dialog-title">Windows protected your PC</p>
        <p className="dh-win-dialog-text">
          Microsoft Defender SmartScreen prevented an unrecognized app from starting. Running this app
          might put your PC at risk.
        </p>
        <div className="dh-win-dialog-actions">
          <span className="dh-win-dialog-link">More info</span>
          <span className="dh-win-dialog-btn">Don&apos;t run</span>
          <span className="dh-win-dialog-btn primary">Run anyway</span>
        </div>
      </div>
    </MediaFrame>
  )
}
