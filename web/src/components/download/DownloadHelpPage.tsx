'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

import { triggerPlatformDownload } from '@/components/DownloadClarifi'
import { SmartScreenMock } from '@/components/download/DownloadPageMocks'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { useCustomerPlatform } from '@/hooks/useCustomerPlatform'
import {
  CLARIFI_VERSION,
  DOWNLOAD_PLATFORMS,
  MAC_QUARANTINE_COMMAND,
  WIN_EXE_FILENAME,
  type DownloadTarget,
  downloadTargetToPlatform,
  parseDownloadTarget,
} from '@/lib/downloads'
import { detectMacArchSync, type CustomerPlatform } from '@/lib/platform'

import '@/components/landing/landing.css'
import '@/app/download/download-help.css'

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }, [text])

  return (
    <button type="button" className="dh-copy-btn" onClick={() => void copy()}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function GuideScreenshot({
  src,
  alt,
  variant = 'mac',
}: {
  src: string
  alt: string
  variant?: 'mac' | 'win'
}) {
  return (
    <div className={`dh-media-frame${variant === 'win' ? ' win' : ''}`}>
      <Image src={src} alt={alt} width={960} height={540} className="dh-guide-img" unoptimized />
    </div>
  )
}

function GuideStep({ num, title, children }: { num: number; title: string; children: ReactNode }) {
  return (
    <div className="dh-step">
      <span className="dh-step-num">{num}</span>
      <div className="dh-step-body">
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}

function MacInstallGuide() {
  return (
    <>
      <h2 className="dh-guide-title">
        <span className="dh-guide-shield" aria-hidden>
          🛡️
        </span>
        How to Install on macOS
      </h2>
      <p className="dh-guide-intro">
        Works on Apple Silicon (M1/M2/M3/M4) and Intel Macs. Newer macOS versions may block apps that
        aren&apos;t from the App Store — here&apos;s how to open Clarifi in under a minute.
      </p>

      <GuideStep num={1} title="Move Clarifi to Applications">
        <p>
          Open the downloaded <strong>.dmg</strong>, drag <strong>Clarifi</strong> into{' '}
          <strong>Applications</strong>, then eject the disk image. Do not run Clarifi directly from the
          DMG.
        </p>
        <GuideScreenshot
          src="/install/mac/step-1-dmg.png"
          alt="Drag Clarifi into the Applications folder from the DMG installer window"
        />
      </GuideStep>

      <GuideStep num={2} title={'Fix "Damaged" warning'}>
        <p>
          If macOS says Clarifi is <strong>damaged</strong> or <strong>can&apos;t be opened</strong>, click{' '}
          <strong>Cancel</strong> or <strong>Done</strong> — do <strong>not</strong> move it to the Trash.
          In Finder → Applications, <strong>right-click Clarifi → Open → Open</strong> the first time.
        </p>
        <GuideScreenshot
          src="/install/mac/step-2-warning.png"
          alt='macOS security dialog showing "Clarifi" not opened because Apple could not verify the app'
        />
      </GuideStep>

      <GuideStep num={3} title="Run Terminal command or Open anyway from settings">
        <p className="dh-step-option-label">Option A — Terminal</p>
        <p>
          Open <strong>Terminal</strong> (search for it in Spotlight) and paste this command, then press
          Enter:
        </p>
        <div className="dh-code-block">
          <code>{MAC_QUARANTINE_COMMAND}</code>
          <CopyButton text={MAC_QUARANTINE_COMMAND} />
        </div>
        <p className="dh-step-footnote">This is a one-time setup. Future updates will install automatically.</p>
        <GuideScreenshot
          src="/install/mac/step-3-terminal.png"
          alt="Terminal window with the xattr quarantine removal command for Clarifi"
        />

        <p className="dh-step-option-label">Option B — System Settings</p>
        <p>
          Open <strong>System Settings → Privacy &amp; Security → Security</strong>, then click{' '}
          <strong>Open Anyway</strong> next to Clarifi.
        </p>
        <GuideScreenshot
          src="/install/mac/step-3-settings.png"
          alt="macOS Privacy and Security settings with Open Anyway button for Clarifi"
        />
      </GuideStep>
    </>
  )
}

function WindowsInstallGuide() {
  return (
    <>
      <h2 className="dh-guide-title">
        <span className="dh-guide-shield" aria-hidden>
          🛡️
        </span>
        How to Install on Windows
      </h2>
      <p className="dh-guide-intro">
        Run the installer from your Downloads folder. Windows may show a SmartScreen warning for new apps —
        here&apos;s how to install Clarifi in under a minute.
      </p>

      <GuideStep num={1} title="Run the installer">
        <p>
          Open <strong>{WIN_EXE_FILENAME}</strong> from your Downloads folder and follow the setup wizard.
          When finished, launch Clarifi from the Start menu or desktop shortcut.
        </p>
      </GuideStep>

      <GuideStep num={2} title="If SmartScreen blocks the installer">
        <p>
          Windows may show &ldquo;Windows protected your PC&rdquo; for apps that are not yet signed with a
          verified publisher certificate. Click <strong>More info</strong>, then{' '}
          <strong>Run anyway</strong>.
        </p>
        <SmartScreenMock />
      </GuideStep>

      <GuideStep num={3} title="Allow microphone access">
        <p style={{ marginBottom: 0 }}>
          When you start a live session, Windows may ask for <strong>microphone</strong> access — allow it
          so Clarifi can transcribe and assist. Dictation on Windows inserts text via clipboard paste
          (Ctrl+V).
        </p>
      </GuideStep>
    </>
  )
}

function resolveDownloadTarget(
  platformParam: string | null,
  archParam: string | null,
  detected: CustomerPlatform,
): DownloadTarget {
  if (platformParam) return parseDownloadTarget(platformParam, archParam)
  if (detected === 'windows') return 'windows'
  return detectMacArchSync() === 'x64' ? 'mac-x64' : 'mac-arm64'
}

async function recordPlatform(target: DownloadTarget): Promise<void> {
  try {
    await fetch('/api/customer/platform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: downloadTargetToPlatform(target) }),
    })
  } catch {
    /* ignore */
  }
}

export function DownloadHelpPage() {
  const searchParams = useSearchParams()
  const detectedPlatform = useCustomerPlatform()
  const downloadTarget = resolveDownloadTarget(
    searchParams.get('platform'),
    searchParams.get('arch'),
    detectedPlatform,
  )
  const autoDownloadedRef = useRef<string | null>(null)

  const restartDownload = useCallback(() => {
    triggerPlatformDownload(downloadTarget)
    void recordPlatform(downloadTarget)
  }, [downloadTarget])

  useEffect(() => {
    const key = `${downloadTarget}:${searchParams.toString()}`
    if (autoDownloadedRef.current === key) return
    autoDownloadedRef.current = key
    triggerPlatformDownload(downloadTarget)
    void recordPlatform(downloadTarget)
  }, [downloadTarget, searchParams])

  const manifest = DOWNLOAD_PLATFORMS.find((p) => p.id === downloadTarget) ?? DOWNLOAD_PLATFORMS[0]
  const isMac = downloadTarget.startsWith('mac')

  return (
    <div className="dh-root landing-root">
      <MarketingNav showBack />

      <div className="dh-layout">
        <header className="dh-header">
          <h1>Thank you for downloading Clarifi!</h1>
          <p>Your download is starting…</p>
          <p>If it doesn&apos;t start automatically, click the button below.</p>
        </header>

        <div className="dh-card dh-card-center">
          <button type="button" className="dh-restart-btn" onClick={restartDownload}>
            <DownloadIcon />
            Restart Download
          </button>
          <p className="dh-version">
            Version v{CLARIFI_VERSION} · {manifest.label}
          </p>

          <div className="dh-platforms-wrap">
            <p className="dh-platforms-label">Other platforms:</p>
            <div className="dh-platform-row">
              {DOWNLOAD_PLATFORMS.map((entry) => (
                <Link
                  key={entry.id}
                  href={entry.href}
                  className={`dh-platform-link${entry.id === downloadTarget ? ' active' : ''}`}
                  onClick={(e) => {
                    if (entry.id === downloadTarget) {
                      e.preventDefault()
                      restartDownload()
                    }
                  }}
                >
                  {entry.pillLabel}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="dh-card dh-card-guide">
          {isMac ? <MacInstallGuide /> : <WindowsInstallGuide />}
        </div>

        <p className="dh-footer">© {new Date().getFullYear()} Clarifi</p>
      </div>
    </div>
  )
}
