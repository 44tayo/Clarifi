'use client'

import Image from 'next/image'
import { type ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const INSTALL_STEPS = [
  {
    num: 1,
    src: '/install/step-1.svg',
    text: (
      <>
        Open <InstallLink>Clarifi.dmg</InstallLink> from your <InstallLink>Downloads</InstallLink> folder
      </>
    ),
  },
  {
    num: 2,
    src: '/install/step-2.svg',
    text: (
      <>
        Drag the <InstallLink>Clarifi icon</InstallLink> into your <InstallLink>Applications</InstallLink>{' '}
        folder
      </>
    ),
  },
  {
    num: 3,
    src: '/install/step-3.svg',
    text: (
      <>
        Open the <InstallLink>Clarifi</InstallLink> app from your <InstallLink>Applications</InstallLink>{' '}
        folder
      </>
    ),
  },
] as const

function InstallLink({ children }: { children: ReactNode }) {
  return <span className="landing-install-link">{children}</span>
}

type InstallModalProps = {
  open: boolean
  onClose: () => void
  onDownloadAgain: () => void
}

export function InstallModal({ open, onClose, onDownloadAgain }: InstallModalProps) {
  const [mounted, setMounted] = useState(false)
  const [showTroubleshoot, setShowTroubleshoot] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setShowTroubleshoot(false)
      return
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open || !mounted) return null

  return createPortal(
    <div className="landing-modal-overlay landing-install-overlay" onClick={onClose} role="presentation">
      <div
        className="landing-modal landing-install-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
      >
        <button type="button" className="landing-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="landing-install-header">
          <div className="landing-downloaded-badge">
            <span className="landing-downloaded-check" aria-hidden>
              ✓
            </span>
            Downloaded
          </div>
          <h2 id="install-title" className="landing-install-title">
            How to install Clarifi
          </h2>
        </div>

        <div className="landing-install-steps">
          {INSTALL_STEPS.map((step) => (
            <div key={step.num} className="landing-install-step">
              <div className="landing-install-illustration-wrap">
                <span className="landing-install-step-num">{step.num}</span>
                <div className="landing-install-illustration">
                  <Image
                    src={step.src}
                    alt=""
                    width={360}
                    height={216}
                    className="landing-install-step-img"
                    unoptimized
                  />
                </div>
              </div>
              <p className="landing-install-step-text">{step.text}</p>
            </div>
          ))}
        </div>

        {showTroubleshoot ? (
          <div className="landing-install-troubleshoot">
            <strong>App won&apos;t open?</strong> On first launch, macOS may ask you to approve Clarifi once.
            <ol>
              <li>
                Drag Clarifi into <strong>Applications</strong> (do not run it from the DMG).
              </li>
              <li>
                In Finder → Applications, <strong>right-click Clarifi → Open → Open</strong> the first
                time.
              </li>
              <li>
                Open Clarifi and sign in with Google, Microsoft, or email to pair your desktop app.
              </li>
              <li>
                For unsigned test builds only, run in Terminal:{' '}
                <code>xattr -cr /Applications/Clarifi.app</code> then try step 2 again.
              </li>
            </ol>
          </div>
        ) : null}

        <p className="landing-install-footer">
          Problem?{' '}
          <button type="button" className="landing-install-download-again" onClick={onDownloadAgain}>
            Download again
          </button>
          {!showTroubleshoot ? (
            <>
              {' '}
              ·{' '}
              <button
                type="button"
                className="landing-install-download-again"
                onClick={() => setShowTroubleshoot(true)}
              >
                App won&apos;t open?
              </button>
            </>
          ) : null}
        </p>
      </div>
    </div>,
    document.body,
  )
}
