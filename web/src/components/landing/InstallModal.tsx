'use client'

type InstallModalProps = {
  open: boolean
  onClose: () => void
  onDownloadAgain: () => void
}

export function InstallModal({ open, onClose, onDownloadAgain }: InstallModalProps) {
  if (!open) return null

  return (
    <div className="landing-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="landing-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="install-title"
      >
        <button type="button" className="landing-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="landing-downloaded-badge">
          <span>✓</span> Downloaded
        </div>
        <h2 id="install-title" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
          How to install Clarifi
        </h2>
        <div className="landing-install-steps">
          <div>
            <div className="landing-install-step-num">1</div>
            <div className="landing-install-illustration">📁</div>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
              Open <strong>Clarifi.dmg</strong> from your <strong>Downloads</strong> folder
            </p>
          </div>
          <div>
            <div className="landing-install-step-num">2</div>
            <div className="landing-install-illustration">↗️</div>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
              Drag the <strong>Clarifi icon</strong> into your <strong>Applications</strong> folder
            </p>
          </div>
          <div>
            <div className="landing-install-step-num">3</div>
            <div className="landing-install-illustration">🚀</div>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
              Open the <strong>Clarifi</strong> app from your <strong>Applications</strong> folder
            </p>
          </div>
        </div>
        <div
          style={{
            marginTop: '1.25rem',
            padding: '0.9rem 1rem',
            borderRadius: '0.75rem',
            background: '#f8fafc',
            border: '1px solid #e5e7eb',
            fontSize: '0.85rem',
            lineHeight: 1.55,
            color: '#374151',
          }}
        >
          <strong>App won&apos;t open?</strong> This build is for <strong>Apple Silicon Macs</strong> (M1/M2/M3/M4) and is not Apple-notarized yet.
          <ol style={{ margin: '0.6rem 0 0', paddingLeft: '1.2rem' }}>
            <li>Drag Clarifi into <strong>Applications</strong> (do not run it from the DMG).</li>
            <li>In Finder → Applications, <strong>right-click Clarifi → Open → Open</strong> the first time.</li>
            <li>
              If you still see &ldquo;can&apos;t be opened,&rdquo; run in Terminal:{' '}
              <code style={{ fontSize: '0.8rem' }}>xattr -cr /Applications/Clarifi.app</code> then try step 2 again.
            </li>
          </ol>
        </div>
        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
          Problem?{' '}
          <button
            type="button"
            onClick={onDownloadAgain}
            style={{
              background: 'none',
              border: 'none',
              color: '#2b6cff',
              cursor: 'pointer',
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            Download again
          </button>
        </p>
      </div>
    </div>
  )
}
