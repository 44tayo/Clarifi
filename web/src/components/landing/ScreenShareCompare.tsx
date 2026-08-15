'use client'

import Image from 'next/image'
import { useCallback, useRef, useState } from 'react'
import './screen-share-compare.css'

type SceneVariant = 'yours' | 'others'

function CompareToolbar() {
  return (
    <div className="ssc-toolbar" aria-hidden>
      <div className="ssc-toolbar-left">
        <span className="ssc-toolbar-dot" />
        <span className="ssc-toolbar-brand">Clarifi</span>
        <span className="ssc-toolbar-pill">General</span>
        <span className="ssc-toolbar-icon">▣</span>
      </div>
      <div className="ssc-toolbar-mid">
        <span className="ssc-toolbar-btn ssc-toolbar-btn-green">◉</span>
        <span className="ssc-toolbar-btn ssc-toolbar-btn-blue">▦</span>
      </div>
      <div className="ssc-toolbar-right">
        <span className="ssc-toolbar-icon">⫶</span>
        <span className="ssc-toolbar-icon">▮▮</span>
        <span className="ssc-toolbar-menu">Sessions ▾</span>
        <span className="ssc-toolbar-menu">History ▾</span>
      </div>
    </div>
  )
}

function CodeLines({ variant }: { variant: SceneVariant }) {
  const redactedWidths = [92, 78, 85, 62, 88, 70, 95, 58, 82, 74, 90, 65, 80, 72]

  if (variant === 'others') {
    return (
      <div className="ssc-lines ssc-lines-redacted" aria-hidden>
        {redactedWidths.map((w, i) => (
          <div key={i} className="ssc-line">
            <span className="ssc-gutter">{i + 1}</span>
            <span className="ssc-bar" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="ssc-lines ssc-lines-real" aria-hidden>
      <div className="ssc-line">
        <span className="ssc-gutter">1</span>
        <span className="ssc-txt">
          <span className="c-comment">{'// Fetch data from API and display results'}</span>
        </span>
      </div>
      <div className="ssc-line">
        <span className="ssc-gutter">2</span>
        <span className="ssc-txt" />
      </div>
      <div className="ssc-line">
        <span className="ssc-gutter">3</span>
        <span className="ssc-txt">
          <span className="c-kw">import</span> axios <span className="c-kw">from</span>{' '}
          <span className="c-str">&apos;axios&apos;</span>;
        </span>
      </div>
      <div className="ssc-line">
        <span className="ssc-gutter">4</span>
        <span className="ssc-txt" />
      </div>
      <div className="ssc-line">
        <span className="ssc-gutter">5</span>
        <span className="ssc-txt">
          <span className="c-kw">async function</span> <span className="c-fn">fetchUserData</span>(
          userId) {'{'}
        </span>
      </div>
      <div className="ssc-line">
        <span className="ssc-gutter">6</span>
        <span className="ssc-txt">
          {'  '}
          <span className="c-kw">try</span> {'{'}
        </span>
      </div>
      {redactedWidths.slice(6).map((w, i) => (
        <div key={i + 7} className="ssc-line">
          <span className="ssc-gutter">{i + 7}</span>
          <span className="ssc-bar" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  )
}

function AssistCard() {
  return (
    <div className="ssc-assist">
      <div className="ssc-assist-title">
        <Image src="/clarifi-logo.png" alt="" width={15} height={15} />
        <span>Clarifi</span>
        <span className="ssc-assist-spark">✨</span>
      </div>
      <p>
        Add a check for missing <code>userId</code> before the pitch. Also handle{' '}
        <code>objection</code> safely.
      </p>
    </div>
  )
}

function CompareScene({ variant }: { variant: SceneVariant }) {
  return (
    <div className="ssc-compose">
      <div className="ssc-assist-slot">
        {variant === 'yours' ? <AssistCard /> : <div className="ssc-assist-spacer" aria-hidden />}
      </div>
      <div className="ssc-ide">
        <div className="ssc-ide-chrome">
          <div className="ssc-traffic">
            <span className="r" />
            <span className="y" />
            <span className="g" />
          </div>
          <div className="ssc-ide-nav">‹ ›</div>
          <div className="ssc-ide-tab">fetchUserData</div>
        </div>
        <div className="ssc-ide-body">
          <div className="ssc-ide-rail" aria-hidden>
            <span>▤</span>
            <span>⌕</span>
            <span>⑂</span>
            <span>▣</span>
            <span>⚙</span>
          </div>
          <CodeLines variant={variant} />
        </div>
      </div>
    </div>
  )
}

export function ScreenShareCompare() {
  const [pos, setPos] = useState(50)
  const dragging = useRef(false)
  const sceneRef = useRef<HTMLDivElement>(null)

  const setFromClientX = useCallback((clientX: number) => {
    const el = sceneRef.current
    if (!el) return
    const { left, width } = el.getBoundingClientRect()
    const pct = Math.min(92, Math.max(8, ((clientX - left) / width) * 100))
    setPos(pct)
  }, [])

  const revealInnerWidth = pos > 0 ? `${(100 / pos) * 100}%` : '100%'

  return (
    <div className="ssc-root">
      <div
        ref={sceneRef}
        className="ssc-scene"
        onPointerMove={(e) => {
          if (!dragging.current) return
          setFromClientX(e.clientX)
        }}
        onPointerUp={() => {
          dragging.current = false
        }}
        onPointerLeave={() => {
          dragging.current = false
        }}
      >
        <CompareToolbar />

        <span className="ssc-label ssc-label-left">Visible to you (private)</span>
        <span className="ssc-label ssc-label-right">Invisible to others (secure)</span>

        <div className="ssc-compare-area">
          <div className="ssc-layer ssc-layer-base">
            <CompareScene variant="others" />
          </div>

          <div className="ssc-layer ssc-layer-reveal" style={{ width: `${pos}%` }}>
            <div className="ssc-layer-reveal-inner" style={{ width: revealInnerWidth }}>
              <div className="ssc-reveal-frame" aria-hidden />
              <CompareScene variant="yours" />
            </div>
          </div>

          <div className="ssc-vline" style={{ left: `${pos}%` }} aria-hidden />

          <button
            type="button"
            className="ssc-handle"
            style={{ left: `${pos}%` }}
            aria-label="Drag to compare your view with screen share"
            onPointerDown={(e) => {
              dragging.current = true
              e.currentTarget.setPointerCapture(e.pointerId)
              setFromClientX(e.clientX)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') setPos((p) => Math.max(8, p - 4))
              if (e.key === 'ArrowRight') setPos((p) => Math.min(92, p + 4))
            }}
          >
            <span>‹</span>
            <span>›</span>
          </button>
        </div>
      </div>
    </div>
  )
}
