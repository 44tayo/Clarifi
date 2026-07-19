import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'

function formatElapsed(startedAt: number | null): string {
  if (!startedAt) return '0:00'
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function RecordingWidget() {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [recording, setRecording] = useState(false)
  const [label, setLabel] = useState('0:00')

  useEffect(() => {
    const off = window.electronAPI.on('widget:state', (payload) => {
      const data = payload as { recording?: boolean; startedAt?: number | null }
      setRecording(Boolean(data.recording))
      setStartedAt(typeof data.startedAt === 'number' ? data.startedAt : null)
    })
    return off
  }, [])

  useEffect(() => {
    if (!recording || !startedAt) {
      setLabel('0:00')
      return
    }
    setLabel(formatElapsed(startedAt))
    const id = window.setInterval(() => setLabel(formatElapsed(startedAt)), 1000)
    return () => window.clearInterval(id)
  }, [recording, startedAt])

  return (
    <div
      className="widget-pill"
      onDoubleClick={() => void window.electronAPI.invoke('widget:focus-main')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 48,
        padding: '0 10px 0 14px',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.94)',
        border: '1px solid rgba(15,23,42,0.08)',
        boxShadow: '0 8px 28px rgba(15,23,42,0.18)',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        userSelect: 'none',
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          background: '#2b6cff',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        C
      </span>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: recording ? '#dc2626' : '#94a3b8' }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', minWidth: 36 }}>{label}</span>
      <button
        type="button"
        aria-label="Stop recording"
        onClick={() => void window.electronAPI.invoke('widget:stop-recording')}
        style={{
          WebkitAppRegion: 'no-drag',
          width: 28,
          height: 28,
          border: 'none',
          borderRadius: 8,
          background: '#0f172a',
          color: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        } as React.CSSProperties}
      >
        <span style={{ width: 10, height: 10, background: '#fff', borderRadius: 2 }} />
      </button>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RecordingWidget />
  </React.StrictMode>,
)
