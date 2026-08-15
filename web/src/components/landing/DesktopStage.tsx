'use client'

import type { ReactNode } from 'react'

type DesktopStageProps = {
  clarifi?: ReactNode
  children: ReactNode
}

const DOCK_ICONS = {
  finder: '/dock/finder.png',
  apps: '/dock/apps.png',
  safari: '/dock/safari.png',
  settings: '/dock/settings.png',
  zoom: '/dock/zoom.png',
  clarifi: '/dock/clarifi.png',
  trash: '/dock/trash.png',
} as const

function DockIcon({
  src,
  label,
  active = false,
}: {
  src: string
  label: string
  active?: boolean
}) {
  return (
    <span
      className={`bento-dock-icon-wrap ${active ? 'active' : ''}`}
      title={label}
      aria-hidden
    >
      <span className="bento-dock-icon hero-dock-icon-img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" width={42} height={42} draggable={false} />
      </span>
    </span>
  )
}

export function DesktopStage({ clarifi, children }: DesktopStageProps) {
  return (
    <div className="hero-desktop-stage">
      <div className="hero-desktop-wallpaper" aria-hidden />

      <header className="hero-desktop-menubar">
        <div className="hero-desktop-menubar-left" aria-hidden>
          <span className="hero-menubar-app-icon">
            <svg viewBox="0 0 18 18" fill="none" aria-hidden>
              <path
                d="M3.25 5.75L3.25 13.75L14.75 13.75L14.75 5.75M3.25 5.75L9 10.5L14.75 5.75"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
        <div className="hero-desktop-menubar-right" aria-hidden>
          <span className="hero-menubar-wifi">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/menubar/wifi.png" alt="" draggable={false} />
          </span>
          <span className="hero-menubar-control-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/menubar/control-center.png" alt="" draggable={false} />
          </span>
        </div>
      </header>

      <div className="hero-desktop-scene">
        {clarifi ? <div className="hero-desktop-clarifi">{clarifi}</div> : null}
        <div className="hero-desktop-window">{children}</div>
      </div>

      <footer className="hero-desktop-dock bento-macbook-dock" aria-hidden>
        <DockIcon src={DOCK_ICONS.finder} label="Finder" />
        <DockIcon src={DOCK_ICONS.apps} label="Apps" />
        <DockIcon src={DOCK_ICONS.safari} label="Safari" />
        <DockIcon src={DOCK_ICONS.settings} label="Settings" />
        <DockIcon src={DOCK_ICONS.zoom} label="Zoom" />
        <DockIcon src={DOCK_ICONS.clarifi} label="Clarifi" />
        <span className="bento-dock-divider" />
        <DockIcon src={DOCK_ICONS.trash} label="Trash" />
      </footer>
    </div>
  )
}
