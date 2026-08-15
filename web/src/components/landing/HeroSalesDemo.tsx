'use client'

import { DesktopStage } from '@/components/landing/DesktopStage'
import { OverlayDemo } from '@/components/landing/OverlayDemo'
import { VideoCallDemo } from '@/components/landing/VideoCallDemo'
import './hero-sales-demo.css'

export function HeroSalesDemo() {
  return (
    <div className="hero-sales-demo">
      <div className="hero-sales-glow" aria-hidden />
      <div className="hero-sales-screen">
        <DesktopStage
          clarifi={
            <OverlayDemo
              size="sm"
              interactive={false}
              defaultRecording
              defaultFollow
              defaultPanelMode="history"
              defaultModeLabel="Meetings"
            />
          }
        >
          <VideoCallDemo
            variant="window"
            layout="hero"
            localSrc="/demo/you.mp4"
            remoteSrc="/demo/them.mp4"
            remoteName="Them"
            meetingTitle="Weekly team sync"
          />
        </DesktopStage>
      </div>
    </div>
  )
}
