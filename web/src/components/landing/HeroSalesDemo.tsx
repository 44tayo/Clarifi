'use client'

import { DesktopStage } from '@/components/landing/DesktopStage'
import { RecordingWidgetMock } from '@/components/landing/RecordingWidgetMock'
import { VideoCallDemo } from '@/components/landing/VideoCallDemo'
import './hero-sales-demo.css'

export function HeroSalesDemo() {
  return (
    <div className="hero-sales-demo">
      <div className="hero-sales-glow" aria-hidden />
      <div className="hero-sales-screen">
        <DesktopStage clarifi={<RecordingWidgetMock />}>
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
