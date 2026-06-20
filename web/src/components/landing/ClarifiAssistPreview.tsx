'use client'

import { cn } from '@/lib/utils'

import './clarifi-assist-preview.css'

const TOOL_SLOTS = [
  {
    id: 'answer',
    title: 'Answer',
    hint: 'Questions in your audio',
    icon: '❓',
  },
  {
    id: 'define',
    title: 'Define',
    hint: 'Acronyms & key terms',
    icon: '📘',
  },
  {
    id: 'speak',
    title: 'What should I say?',
    hint: 'When they finish speaking',
    icon: '✦',
  },
  {
    id: 'follow-up',
    title: 'Follow-up',
    hint: 'Discovery & pain points',
    icon: '💬',
  },
] as const

function MicIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  )
}

function ScreenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
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

type ClarifiAssistPreviewProps = {
  className?: string
}

export function ClarifiAssistPreview({ className }: ClarifiAssistPreviewProps) {
  return (
    <div className={cn('cap-root', className)} aria-hidden>
      <div className="cap-body">
        <div className="cap-view-switch">
          <span className="cap-view-switch-btn active">Assist</span>
          <span className="cap-view-switch-btn">Transcript</span>
        </div>

        <p className="cap-viewed-label">Viewed screen</p>

        <div className="cap-tool-rail">
          {TOOL_SLOTS.map((slot) => (
            <div key={slot.id} className="cap-tool-slot">
              <div className="cap-tool-slot-row">
                <span className="cap-tool-slot-accent" aria-hidden />
                <span className="cap-tool-slot-icon" aria-hidden>
                  {slot.icon}
                </span>
                <span className="cap-tool-slot-copy">
                  <span className="cap-tool-slot-title">{slot.title}</span>
                  <span className="cap-tool-slot-hint">{slot.hint}</span>
                </span>
                <span className="cap-tool-slot-status">Waiting</span>
              </div>
            </div>
          ))}
        </div>

        <p className="cap-recap">Recap so far</p>
      </div>

      <div className="cap-composer">
        <div className="cap-composer-row">
          <span className="cap-composer-input">Ask or search anything about my screen</span>
          <span className="cap-composer-mic">
            <MicIcon />
          </span>
        </div>
      </div>

      <div className="cap-toolbar">
        <div className="cap-toolbar-left">
          <span className="cap-dot" aria-hidden />
          <span className="cap-brand">Clarifi</span>
          <span className="cap-pill">General</span>
          <span className="cap-icon active">
            <ScreenIcon />
          </span>
          <span className="cap-icon stealth">
            <StealthIcon />
          </span>
          <span className="cap-icon">
            <FollowIcon />
          </span>
        </div>

        <span className="cap-divider" aria-hidden />

        <div className="cap-toolbar-right">
          <span className="cap-icon cap-pause" aria-hidden>
            ⏸
          </span>
          <span className="cap-waveform" aria-hidden>
            <span />
            <span />
            <span />
            <span />
          </span>
          <span className="cap-history">
            History
            <span className="cap-history-chevron">▼</span>
          </span>
        </div>
      </div>
    </div>
  )
}
