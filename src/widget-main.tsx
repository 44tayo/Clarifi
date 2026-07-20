import { useCallback, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'

import { WidgetCompact } from './components/widget/WidgetCompact'
import { WidgetNotepadPanel, type WidgetPanel } from './components/widget/WidgetNotepadPanel'
import type { TranscriptEntry } from './types/meeting'
import './styles/widget.css'

function formatElapsed(startedAt: number, pausedOffsetMs: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - startedAt - pausedOffsetMs) / 1000))
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

type WidgetState = {
  recording?: boolean
  startedAt?: number | null
  mode?: 'compact' | 'expanded'
  panel?: WidgetPanel
  theme?: 'light' | 'dark'
  meetingId?: string | null
  activity?: string
  paused?: boolean
}

function RecordingWidgetApp() {
  const [state, setState] = useState<WidgetState>({})
  const [elapsed, setElapsed] = useState('0:00')
  const [title, setTitle] = useState('Meeting note')
  const [notes, setNotes] = useState('')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [speakerLabels, setSpeakerLabels] = useState<Record<string, string>>({})
  const pausedOffsetRef = useRef(0)
  const pauseStartedRef = useRef<number | null>(null)

  const recording = Boolean(state.recording)
  const paused = Boolean(state.paused)
  const mode = state.mode ?? 'compact'
  const panel = state.panel ?? 'notepad'
  const theme = state.theme ?? 'light'
  const activity = state.activity ?? 'silent'
  const startedAt = state.startedAt ?? null

  const refreshSession = useCallback(async () => {
    const session = (await window.electronAPI.invoke('widget:get-session')) as {
      title?: string
      userNotes?: string
      transcript?: TranscriptEntry[]
      speakerLabels?: Record<string, string>
    }
    setTitle(session.title ?? 'Meeting note')
    setNotes(session.userNotes ?? '')
    setTranscript(Array.isArray(session.transcript) ? session.transcript : [])
    setSpeakerLabels(session.speakerLabels ?? {})
  }, [])

  useEffect(() => {
    const offState = window.electronAPI.on('widget:state', (payload) => {
      const next = payload as WidgetState
      setState((prev) => {
        if (next.paused && !prev.paused) {
          pauseStartedRef.current = Date.now()
        }
        if (!next.paused && prev.paused && pauseStartedRef.current) {
          pausedOffsetRef.current += Date.now() - pauseStartedRef.current
          pauseStartedRef.current = null
        }
        if (!next.recording) {
          pausedOffsetRef.current = 0
          pauseStartedRef.current = null
        }
        return next
      })
    })
    const offTranscript = window.electronAPI.on('transcript:update', (payload) => {
      const data = payload as { full?: TranscriptEntry[] }
      if (Array.isArray(data.full)) setTranscript(data.full)
    })
    const offActivity = window.electronAPI.on('transcription:activity', (payload) => {
      const data = payload as { state?: string }
      if (data.state) {
        setState((prev) => ({ ...prev, activity: data.state }))
      }
    })
    void refreshSession()
    return () => {
      offState()
      offTranscript()
      offActivity()
    }
  }, [refreshSession])

  useEffect(() => {
    if (mode === 'expanded') {
      void refreshSession()
    }
  }, [mode, refreshSession])

  useEffect(() => {
    document.body.classList.toggle('widget-theme-dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    if (!recording || !startedAt) {
      setElapsed('0:00')
      return
    }

    const update = () => {
      let offset = pausedOffsetRef.current
      if (paused && pauseStartedRef.current) {
        offset += Date.now() - pauseStartedRef.current
      }
      setElapsed(formatElapsed(startedAt, offset))
    }

    update()
    if (paused) return

    const id = window.setInterval(update, 1000)
    return () => window.clearInterval(id)
  }, [recording, startedAt, paused])

  const handleNotesChange = useCallback((value: string) => {
    setNotes(value)
    void window.electronAPI.invoke('widget:update-notes', { userNotes: value })
  }, [])

  const handleRenameSpeaker = useCallback((canonical: string, displayName: string) => {
    setSpeakerLabels((prev) => ({ ...prev, [canonical]: displayName }))
    void window.electronAPI.invoke('widget:rename-speaker', { speaker: canonical, name: displayName })
  }, [])

  const handlePanelChange = useCallback((next: WidgetPanel) => {
    void window.electronAPI.invoke('widget:set-panel', { panel: next })
  }, [])

  if (mode === 'expanded') {
    return (
      <div className={`widget-root${theme === 'dark' ? ' widget-root--dark' : ''}`}>
        <WidgetNotepadPanel
          title={title}
          elapsed={elapsed}
          recording={recording}
          paused={paused}
          activity={activity}
          panel={panel}
          notes={notes}
          transcript={transcript}
          speakerLabels={speakerLabels}
          onPanelChange={handlePanelChange}
          onNotesChange={handleNotesChange}
          onCollapse={() => void window.electronAPI.invoke('widget:collapse')}
          onMaximize={() => void window.electronAPI.invoke('widget:open-meeting')}
          onPause={() => void window.electronAPI.invoke('widget:pause-recording')}
          onResume={() => void window.electronAPI.invoke('widget:resume-recording')}
          onStop={() => void window.electronAPI.invoke('widget:stop-recording')}
          onRenameSpeaker={handleRenameSpeaker}
        />
      </div>
    )
  }

  return (
    <div className={`widget-root${theme === 'dark' ? ' widget-root--dark' : ''}`}>
      <WidgetCompact
        recording={recording}
        paused={paused}
        activity={activity}
        elapsed={elapsed}
        onExpand={() => void window.electronAPI.invoke('widget:expand')}
        onPause={() => void window.electronAPI.invoke('widget:pause-recording')}
        onResume={() => void window.electronAPI.invoke('widget:resume-recording')}
        onStop={() => void window.electronAPI.invoke('widget:stop-recording')}
      />
    </div>
  )
}

export default RecordingWidgetApp

ReactDOM.createRoot(document.getElementById('root')!).render(<RecordingWidgetApp />)
