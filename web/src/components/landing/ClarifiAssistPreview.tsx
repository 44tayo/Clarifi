'use client'

import { cn } from '@/lib/utils'

import './clarifi-assist-preview.css'

type ClarifiAssistPreviewProps = {
  className?: string
}

export function ClarifiAssistPreview({ className }: ClarifiAssistPreviewProps) {
  return (
    <div className={cn('cap-root', className)} aria-hidden>
      <div className="cap-body">
        <p className="cap-recap">Meeting ready</p>
        <p className="cap-tool-slot-title" style={{ marginBottom: 8 }}>
          Acme Corp — Pilot Kickoff
        </p>
        <div className="cap-tool-slots">
          <div className="cap-tool-slot">
            <div className="cap-tool-slot-main">
              <span className="cap-tool-slot-copy">
                <span className="cap-tool-slot-title">Summary</span>
                <span className="cap-tool-slot-hint">
                  Agreed on a 2-week pilot. Security one-pager before sign-off.
                </span>
              </span>
            </div>
          </div>
          <div className="cap-tool-slot">
            <div className="cap-tool-slot-main">
              <span className="cap-tool-slot-copy">
                <span className="cap-tool-slot-title">Decisions</span>
                <span className="cap-tool-slot-hint">Pilot starts Monday · Clarifi sends timeline by EOD</span>
              </span>
            </div>
          </div>
          <div className="cap-tool-slot">
            <div className="cap-tool-slot-main">
              <span className="cap-tool-slot-copy">
                <span className="cap-tool-slot-title">Action items</span>
                <span className="cap-tool-slot-hint">Send one-pager · Schedule Friday decision call</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="cap-toolbar">
        <div className="cap-toolbar-left">
          <span className="cap-dot" aria-hidden />
          <span className="cap-brand">Clarifi</span>
          <span className="cap-pill">Summary</span>
        </div>

        <span className="cap-divider" aria-hidden />

        <div className="cap-toolbar-right">
          <span className="cap-history">
            Transcript
            <span className="cap-history-chevron">·</span>
            Scratchpad
          </span>
        </div>
      </div>
    </div>
  )
}
