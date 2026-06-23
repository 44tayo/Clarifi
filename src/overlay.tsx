import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { anthropicShortLabel } from './lib/anthropic-models'
import { entriesToDisplayLines, type SpeakerLabels } from './lib/transcriptSpeakers'
import './overlay.css'
import { OverlayChatPanel } from './components/OverlayChatPanel'
import { RecordingSessionCard } from './components/RecordingSessionCard'
import { playUiClick, playUiDrag, playUiToggle, setUiSoundsEnabled } from './lib/uiSounds'

function ToolbarTooltip({
  label,
  children,
  placement = 'above',
}: {
  label: string
  children: ReactNode
  placement?: 'above' | 'below'
}) {
  return (
    <div className="toolbar-tooltip-wrap">
      <span
        className={`toolbar-tooltip ${placement === 'below' ? 'toolbar-tooltip-below' : ''}`}
        role="tooltip"
      >
        {label}
      </span>
      {children}
    </div>
  )
}

interface Suggestion {
  text: string
  type: 'response' | 'question' | 'action'
}

type LiveSessionInsights = {
  meetingIntro: string
  runningSummary: string
  topics: string[]
  entities: { name: string; type: 'person' | 'company' | 'other' }[]
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'
  keyMoments: string[]
  decisions: string[]
  openQuestions: string[]
}

type SalesAssistAction = {
  kind: string
  label: string
  speakable: string
  context?: string
}

type SessionRecap = {
  summary: string
  highlights: string[]
  discussionPoints?: string[]
  actionItems: string[]
  decisions?: string[]
  openQuestions: string[]
  recapEmailDraft: string
  dealSummary?: string
  painPointsUncovered?: string[]
  prospectFollowUpEmail?: string
}

type TranscriptEntry = {
  id: string
  text: string
  source: 'mic' | 'system'
  speaker: string
  at: number
}

const MIC_SEGMENT_MS = 1000
const MIC_SEGMENT_MIN_MS = 400
const MIC_SILENCE_MS = 500
const MIC_SILENCE_RMS = 0.006
const MIC_SPEECH_RMS_MIN = 0.008

function normalizeEntry(entry: TranscriptEntry): TranscriptEntry {
  const speaker = entry.speaker?.trim() ?? ''
  return {
    ...entry,
    speaker: speaker || (entry.source === 'mic' ? 'Me' : 'Them'),
  }
}

const TITLE_STOP_WORDS = new Set([
  'that',
  'this',
  'with',
  'have',
  'from',
  'they',
  'what',
  'when',
  'your',
  'about',
  'would',
  'could',
  'there',
  'their',
  'been',
  'were',
  'will',
  'just',
  'like',
  'know',
  'think',
  'going',
  'really',
  'some',
  'into',
  'than',
  'them',
  'then',
  'also',
  'very',
  'only',
  'over',
  'such',
  'need',
  'want',
  'yeah',
  'okay',
  'right',
  'well',
  'mean',
  'thank',
  'thanks',
  'hello',
  'sorry',
])

function titleFromTranscriptKeywords(entries: TranscriptEntry[]): string | null {
  if (entries.length === 0) return null

  const prospectQuestion = entries.find(
    (entry) =>
      (entry.source === 'system' || entry.speaker === 'Them') &&
      entry.text.includes('?') &&
      entry.text.trim().length > 15,
  )
  if (prospectQuestion) {
    const question = `${prospectQuestion.text.split('?')[0].trim()}?`
    return question.length > 80 ? `${question.slice(0, 77)}...` : question
  }

  const fullText = entries.map((entry) => entry.text).join(' ')
  const counts = new Map<string, number>()
  for (const word of fullText.toLowerCase().match(/[a-z][a-z]{3,}/g) ?? []) {
    if (TITLE_STOP_WORDS.has(word)) continue
    counts.set(word, (counts.get(word) ?? 0) + 1)
  }
  const topWords = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word)
  if (topWords.length >= 2) {
    return topWords.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' · ')
  }

  const firstSubstantial = entries.find((entry) => entry.text.trim().length > 12)
  if (firstSubstantial) {
    const snippet = firstSubstantial.text.trim().split(/[.!?]/)[0]?.trim()
    if (snippet) return snippet.slice(0, 80)
  }

  return null
}

function generateAudioSessionTitle(
  recap: SessionRecap | null,
  startedAt: number | null,
  transcript: TranscriptEntry[] = [],
): string {
  if (recap?.dealSummary?.trim()) {
    return recap.dealSummary.trim().slice(0, 80)
  }
  if (recap?.painPointsUncovered?.[0]?.trim()) {
    return recap.painPointsUncovered[0].trim().slice(0, 80)
  }
  if (recap?.summary?.trim()) {
    const sentence = recap.summary.split(/[.!?]/)[0]?.trim()
    if (sentence) return sentence.slice(0, 80)
  }

  const fromTranscript = titleFromTranscriptKeywords(transcript)
  if (fromTranscript) return fromTranscript

  const date = new Date(startedAt ?? Date.now())
  return `Audio session ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function parseTranscriptPayload(
  payload: unknown,
): { recent: TranscriptEntry[]; full: TranscriptEntry[] } | null {
  if (Array.isArray(payload)) {
    const legacy = (payload as string[]).map((text, index) => ({
      id: `legacy-${index}`,
      text,
      source: 'mic' as const,
      speaker: 'Me',
      at: Date.now(),
    }))
    return { recent: legacy, full: legacy }
  }

  const data = payload as { recent?: TranscriptEntry[]; full?: TranscriptEntry[] }
  if (!Array.isArray(data?.full)) return null

  return {
    recent: (Array.isArray(data.recent) ? data.recent : data.full).map(normalizeEntry),
    full: data.full.map(normalizeEntry),
  }
}

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  usedScreen?: boolean
  gmailQuery?: string
  gmailNotConnected?: boolean
}

type ChatSession = {
  id: string
  title: string
  createdAt: number
  messages: ChatMessage[]
  archived?: boolean
}

function sessionTitleFromMessages(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user')
  const raw = firstUser?.content ?? 'Chat'
  return raw.length > 48 ? `${raw.slice(0, 45)}...` : raw
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

const typeColors: Record<string, string> = {
  response: 'rgba(34, 197, 94, 0.2)',
  question: 'rgba(59, 130, 246, 0.2)',
  action: 'rgba(249, 115, 22, 0.2)',
}

const typeLabels: Record<string, string> = {
  response: '📘',
  question: '❓',
  action: '💬',
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

type PanelMode =
  | 'bar'
  | 'chat'
  | 'history'
  | 'audio_sessions'
  | 'audio_session_detail'
  | 'live_session'
  | 'session_recap'

type AudioSessionChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type StoredAudioSession = {
  id: string
  title: string
  createdAt: number
  endedAt: number
  transcript: TranscriptEntry[]
  recap: SessionRecap | null
  chatMessages: AudioSessionChatMessage[]
  speakerLabels?: SpeakerLabels
}

type ConnectionState = 'loading' | 'connected' | 'needs_connect' | 'optional'

type ModelConfig = {
  id: string
  label: string
  provider: string
  modelId: string
  builtin?: boolean
}

type ModeConfig = {
  id: string
  label: string
  category?: string
  systemPrompt: string
  isActive: boolean
}

type PublicPreferences = {
  activeModelId: string
  models: ModelConfig[]
  activeModeId: string
  modes: ModeConfig[]
  showModelInToolbar: boolean
  productKnowledge?: string
}

const OVERLAY_HEIGHT_COLLAPSED = 168
const OVERLAY_HEIGHT_CONNECT = 204
const OVERLAY_HEIGHT_RECORDING = 400
const OVERLAY_HEIGHT_EXPANDED = 360
const OVERLAY_HEIGHT_CHAT = 480

const OVERLAY_MIN_WIDTH = 480
const OVERLAY_MAX_WIDTH = 900
const OVERLAY_MIN_HEIGHT = 132
const OVERLAY_MAX_HEIGHT = 700

type ResizeEdge = 'left' | 'top' | 'right' | 'bottom' | 'corner'

function ResizeHandles({
  onResize,
}: {
  onResize: (width: number, height: number) => void
}) {
  const dragRef = useRef<{
    edge: ResizeEdge
    startX: number
    startY: number
    startW: number
    startH: number
    startWinX: number
    startWinY: number
  } | null>(null)
  const [activeEdge, setActiveEdge] = useState<ResizeEdge | null>(null)

  const onMouseDown = (edge: ResizeEdge) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    playUiDrag()
    dragRef.current = {
      edge,
      startX: e.screenX,
      startY: e.screenY,
      startW: window.innerWidth,
      startH: window.innerHeight,
      startWinX: window.screenX,
      startWinY: window.screenY,
    }
    setActiveEdge(edge)
    document.body.style.cursor =
      edge === 'left' || edge === 'right'
        ? 'ew-resize'
        : edge === 'top' || edge === 'bottom'
          ? 'ns-resize'
          : 'nwse-resize'
  }

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const dx = e.screenX - drag.startX
      const dy = e.screenY - drag.startY
      let newW = drag.startW
      let newH = drag.startH
      let newX = drag.startWinX
      let newY = drag.startWinY

      if (drag.edge === 'right' || drag.edge === 'corner') {
        newW = drag.startW + dx
      }
      if (drag.edge === 'left') {
        newW = drag.startW - dx
        newX = drag.startWinX + dx
      }
      if (drag.edge === 'bottom' || drag.edge === 'corner') {
        newH = drag.startH + dy
      }
      if (drag.edge === 'top') {
        newH = drag.startH - dy
        newY = drag.startWinY + dy
      }

      newW = Math.max(OVERLAY_MIN_WIDTH, Math.min(newW, OVERLAY_MAX_WIDTH))
      newH = Math.max(OVERLAY_MIN_HEIGHT, Math.min(newH, OVERLAY_MAX_HEIGHT))

      if (drag.edge === 'left') {
        newX = drag.startWinX + (drag.startW - newW)
      }
      if (drag.edge === 'top') {
        newY = drag.startWinY + (drag.startH - newH)
      }

      void window.electronAPI.invoke('overlay:set-bounds', {
        width: newW,
        height: newH,
        x: newX,
        y: newY,
        persist: false,
      })
      onResize(newW, newH)
    }

    const onMouseUp = () => {
      if (dragRef.current) {
        void window.electronAPI.invoke('overlay:set-bounds', {
          width: window.innerWidth,
          height: window.innerHeight,
          x: window.screenX,
          y: window.screenY,
          persist: true,
        })
      }
      dragRef.current = null
      setActiveEdge(null)
      document.body.style.cursor = ''
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
    }
  }, [onResize])

  const edges: ResizeEdge[] = ['left', 'top', 'right', 'bottom', 'corner']

  return (
    <>
      {edges.map((edge) => (
        <div
          key={edge}
          className={`resize-handle resize-handle-${edge} ${activeEdge === edge ? 'active' : ''}`}
          onMouseDown={onMouseDown(edge)}
        />
      ))}
    </>
  )
}

export default function Overlay() {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [status, setStatus] = useState('')
  const [panelMode, setPanelMode] = useState<PanelMode>('bar')
  const [query, setQuery] = useState('')
  const [followEnabled, setFollowEnabled] = useState(true)
  const [stealthEnabled, setStealthEnabled] = useState(true)
  const [dictationEnabled, setDictationEnabled] = useState(true)
  const [stealthFlash, setStealthFlash] = useState(false)
  const [screenContextEnabled, setScreenContextEnabled] = useState(false)
  const [chatStatus, setChatStatus] = useState('')
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [connectionState, setConnectionState] = useState<ConnectionState>('loading')
  const [connectError, setConnectError] = useState('')
  const [prefs, setPrefs] = useState<PublicPreferences | null>(null)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [fullTranscript, setFullTranscript] = useState<TranscriptEntry[]>([])
  const [, setSessionInsights] = useState<LiveSessionInsights | null>(null)
  const [liveActions, setLiveActions] = useState<SalesAssistAction[]>([])
  const [liveAssistError, setLiveAssistError] = useState('')
  const [, setSessionRecap] = useState<SessionRecap | null>(null)
  const [, setShowLiveInsights] = useState(true)
  const [, setInsightsLoading] = useState(false)
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null)
  const [, setTranscriptSearch] = useState('')
  const [viewingAudioSession, setViewingAudioSession] = useState<StoredAudioSession | null>(null)
  const [, setAudioSessionChatMessages] = useState<AudioSessionChatMessage[]>(
    [],
  )
  const [, setAudioSessionChatStatus] = useState('')
  const [liveSpeakerLabels, setLiveSpeakerLabels] = useState<SpeakerLabels>({})
  const [transcriptionMode, setTranscriptionMode] = useState<'dual' | 'group'>('dual')
  const [transcriptionActivity, setTranscriptionActivity] = useState<
    'silent' | 'listening' | 'transcribing'
  >('listening')
  const [sessionReply, setSessionReply] = useState('')
  const [sessionLoading, setSessionLoading] = useState(false)
  const [tourStep, setTourStep] = useState<string | null>(null)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const prevPanelForTourRef = useRef<PanelMode>('bar')
  const chatBodyRef = useRef<HTMLDivElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const isCapturingRef = useRef(false)
  const mimeTypeRef = useRef('audio/webm')
  const micSegmentTimerRef = useRef<number | null>(null)
  const micAudioContextRef = useRef<AudioContext | null>(null)
  const micAnalyserRef = useRef<AnalyserNode | null>(null)
  const micSpeechCheckRef = useRef<number | null>(null)
  const micSegmentMaxRmsRef = useRef(0)
  const micSegmentStartedAtRef = useRef(0)
  const micSilentMsRef = useRef(0)
  const modelMenuRef = useRef<HTMLDivElement | null>(null)

  const needsConnect = connectionState === 'needs_connect'

  const isDropdownPanel = panelMode === 'history'
  const isChatPanel = panelMode === 'chat' || chatLoading
  const hasActiveChat = chatMessages.length > 0
  const isSessionRecap = panelMode === 'session_recap'
  const allChatSessions = (() => {
    const sessions = [...chatSessions]
    if (activeSessionId && chatMessages.length > 0) {
      const idx = sessions.findIndex((s) => s.id === activeSessionId)
      const current: ChatSession = {
        id: activeSessionId,
        title: sessions[idx]?.title ?? sessionTitleFromMessages(chatMessages),
        createdAt: sessions[idx]?.createdAt ?? Date.now(),
        messages: chatMessages,
      }
      if (idx >= 0) sessions[idx] = current
      else sessions.unshift(current)
    }
    return sessions.sort((a, b) => b.createdAt - a.createdAt)
  })()
  const activeChatSessions = allChatSessions.filter((s) => !s.archived)
  const recentChatSessions = activeChatSessions.slice(0, 3)
  const hasMoreChatHistory = activeChatSessions.length > 3
  const hasAnyHistory =
    chatSessions.length > 0 ||
    chatMessages.length > 0 ||
    transcript.length > 0 ||
    suggestions.length > 0 ||
    Boolean(status)

  const applyBounds = useCallback((width: number, height: number, persist = false) => {
    void window.electronAPI.invoke('overlay:set-bounds', { width, height, persist })
  }, [])

  const syncHeight = useCallback(() => {
    let height = needsConnect
      ? OVERLAY_HEIGHT_CONNECT
      : isRecording
        ? OVERLAY_HEIGHT_RECORDING
        : OVERLAY_HEIGHT_COLLAPSED
    if (panelMode === 'chat' || chatLoading) {
      height = OVERLAY_HEIGHT_CHAT
    } else if (isDropdownPanel) {
      height = OVERLAY_HEIGHT_EXPANDED
    }
    void window.electronAPI.invoke('overlay:get-bounds').then((bounds) => {
      const b = bounds as { width?: number }
      const width = typeof b?.width === 'number' ? b.width : OVERLAY_MIN_WIDTH
      void window.electronAPI.invoke('overlay:set-bounds', { width, height, persist: true })
    })
  }, [needsConnect, isRecording, isDropdownPanel, panelMode, chatLoading])

  useEffect(() => {
    void window.electronAPI.invoke('overlay:set-interactive', true)
  }, [])

  useEffect(() => {
    syncHeight()
  }, [syncHeight])

  const tourHighlight = useCallback(
    (target: string) => {
      const active =
        tourStep === target ||
        (tourStep === 'enter' && target === 'input') ||
        (tourStep === 'toggle' && target === 'toolbar')
      return active ? ' overlay-tour-highlight' : ''
    },
    [tourStep],
  )

  useEffect(() => {
    window.electronAPI.on('overlay:tour', (payload) => {
      const data = payload as { step?: string | null }
      setTourStep(data?.step ?? null)
    })
  }, [])

  useEffect(() => {
    if (tourStep === 'listen' && isRecording) {
      void window.electronAPI.invoke('onboarding:tutorial-signal', { type: 'listen' })
    }
  }, [tourStep, isRecording])

  useEffect(() => {
    if (tourStep === 'chat' && prevPanelForTourRef.current === 'chat' && panelMode === 'bar') {
      void window.electronAPI.invoke('onboarding:tutorial-signal', { type: 'chat' })
    }
    if (
      tourStep === 'sessions' &&
      prevPanelForTourRef.current === 'bar' &&
      panelMode === 'history'
    ) {
      void window.electronAPI.invoke('onboarding:tutorial-signal', { type: 'sessions' })
    }
    prevPanelForTourRef.current = panelMode
  }, [panelMode, tourStep])

  useEffect(() => {
    window.electronAPI.on('transcript:update', (payload) => {
      const parsed = parseTranscriptPayload(payload)
      if (!parsed) return
      setTranscript([...parsed.recent])
      setFullTranscript([...parsed.full])
    })
    window.electronAPI.on('suggestions:update', (s) => {
      if (Array.isArray(s)) {
        setSuggestions([...(s as Suggestion[])])
      }
    })
    window.electronAPI.on('live-assist:update', (payload) => {
      if (!payload || typeof payload !== 'object') return
      const data = payload as {
        actions?: SalesAssistAction[]
        error?: string | null
      }
      if (data.error) {
        setLiveAssistError(data.error)
        return
      }
      if (Array.isArray(data.actions)) {
        setLiveActions([...data.actions])
        setLiveAssistError('')
      }
    })

    window.electronAPI.on('prefs:changed', (next) => {
      setPrefs(next as PublicPreferences)
    })
    window.electronAPI.on('chat:history-changed', (payload) => {
      const data = payload as { sessions?: ChatSession[] }
      if (Array.isArray(data?.sessions)) {
        setChatSessions(data.sessions)
      }
    })
    window.electronAPI.on('audio-sessions:changed', () => {
      // Settings page listens for session list updates.
    })
    window.electronAPI.on('transcription:activity', (payload) => {
      const state = (payload as { state?: string })?.state
      if (state === 'silent' || state === 'listening' || state === 'transcribing') {
        setTranscriptionActivity(state)
      }
    })
  }, [])

  useEffect(() => {
    void window.electronAPI.invoke('chat:history-load').then((data) => {
      const result = data as { sessions?: ChatSession[] }
      if (Array.isArray(result?.sessions)) {
        setChatSessions(result.sessions)
      }
    })
  }, [])

  useEffect(() => {
    void window.electronAPI.invoke('prefs:load').then((data) => {
      setPrefs(data as PublicPreferences)
    })
    void window.electronAPI.invoke('audio:prefs-load').then((data) => {
      const prefs = data as {
        transcriptionMode?: 'dual' | 'group'
        dictationEnabled?: boolean
        uiSoundsEnabled?: boolean
      }
      if (prefs.transcriptionMode) setTranscriptionMode(prefs.transcriptionMode)
      if (typeof prefs.dictationEnabled === 'boolean') setDictationEnabled(prefs.dictationEnabled)
      if (typeof prefs.uiSoundsEnabled === 'boolean') setUiSoundsEnabled(prefs.uiSoundsEnabled)
    })
    window.electronAPI.on('audio:prefs-changed', (data) => {
      const prefs = data as {
        transcriptionMode?: 'dual' | 'group'
        dictationEnabled?: boolean
        uiSoundsEnabled?: boolean
      }
      if (prefs.transcriptionMode) setTranscriptionMode(prefs.transcriptionMode)
      if (typeof prefs.dictationEnabled === 'boolean') setDictationEnabled(prefs.dictationEnabled)
      if (typeof prefs.uiSoundsEnabled === 'boolean') setUiSoundsEnabled(prefs.uiSoundsEnabled)
    })
  }, [])

  useEffect(() => {
    if (!prefs?.showModelInToolbar) {
      setModelMenuOpen(false)
    }
  }, [prefs?.showModelInToolbar])

  useEffect(() => {
    if (!modelMenuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [modelMenuOpen])

  const refreshConnection = useCallback(async () => {
    const status = (await window.electronAPI.invoke('auth:connection-status')) as {
      connected?: boolean
      hasApiUrl?: boolean
    }

    if (!status.hasApiUrl) {
      setConnectionState('optional')
      setConnectError('')
      return
    }

    if (status.connected) {
      setConnectionState('connected')
      setConnectError('')
      return
    }

    setConnectionState('needs_connect')
  }, [])

  useEffect(() => {
    void refreshConnection()
  }, [refreshConnection])

  useEffect(() => {
    if (connectionState !== 'needs_connect') return

    const interval = window.setInterval(() => {
      void window.electronAPI.invoke('auth:connection-status').then((data) => {
        const status = data as { connected?: boolean }
        if (status.connected) {
          setConnectionState('connected')
          setConnectError('')
        }
      })
    }, 3000)

    return () => window.clearInterval(interval)
  }, [connectionState])

  const openConnectPage = useCallback(async () => {
    setConnectError('')
    try {
      await window.electronAPI.invoke('auth:open-connect')
    } catch {
      setConnectError('Could not open browser')
    }
  }, [])

  const syncToolbarPrefs = useCallback(async () => {
    const [follow, protection, screen] = await Promise.all([
      window.electronAPI.invoke('overlay:follow-status'),
      window.electronAPI.invoke('overlay:protection-status'),
      window.electronAPI.invoke('screen:context-status'),
    ])
    const followResult = follow as { enabled?: boolean }
    const protectionResult = protection as { enabled?: boolean }
    const screenResult = screen as { enabled?: boolean }
    if (typeof followResult?.enabled === 'boolean') {
      setFollowEnabled(followResult.enabled)
    }
    if (typeof protectionResult?.enabled === 'boolean') {
      setStealthEnabled(protectionResult.enabled)
    }
    if (typeof screenResult?.enabled === 'boolean') {
      setScreenContextEnabled(screenResult.enabled)
    }
  }, [])

  useEffect(() => {
    void syncToolbarPrefs()
    window.electronAPI.on('overlay:protection-changed', (payload) => {
      const next = payload as { enabled?: boolean }
      if (typeof next?.enabled === 'boolean') {
        setStealthEnabled(next.enabled)
      }
    })
  }, [syncToolbarPrefs])

  useEffect(() => {
    void syncToolbarPrefs()
  }, [panelMode, syncToolbarPrefs])

  const handleNewChat = useCallback(() => {
    setActiveSessionId(null)
    setChatMessages([])
    setChatStatus('')
    setChatLoading(false)
    setQuery('')
    setViewingAudioSession(null)
    setAudioSessionChatMessages([])
    setAudioSessionChatStatus('')
    setPanelMode('bar')
  }, [])

  const loadSession = useCallback((session: ChatSession) => {
    setActiveSessionId(session.id)
    setChatMessages(session.messages)
    setChatStatus('')
    setPanelMode('chat')
  }, [])

  useEffect(() => {
    window.electronAPI.on('chat:session-open', (session) => {
      const data = session as ChatSession
      if (data?.id && Array.isArray(data.messages)) {
        loadSession(data)
      }
    })
  }, [loadSession])

  const persistSession = useCallback(
    async (sessionId: string, messages: ChatMessage[]) => {
      if (messages.length === 0) return
      const existing = chatSessions.find((s) => s.id === sessionId)
      const session: ChatSession = {
        id: sessionId,
        title: existing?.title ?? sessionTitleFromMessages(messages),
        createdAt: existing?.createdAt ?? Date.now(),
        messages,
        archived: existing?.archived,
      }
      const result = (await window.electronAPI.invoke('chat:history-save-session', {
        session,
      })) as { sessions?: ChatSession[] }
      if (Array.isArray(result?.sessions)) {
        setChatSessions(result.sessions)
      }
    },
    [chatSessions],
  )

  const checkScroll = useCallback(() => {
    const el = chatBodyRef.current
    if (!el) return
    const hasOverflow = el.scrollHeight > el.clientHeight + 4
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    setShowScrollDown(hasOverflow && !atBottom)
  }, [])

  useEffect(() => {
    const el = chatBodyRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll)
    checkScroll()
    return () => el.removeEventListener('scroll', checkScroll)
  }, [chatMessages, chatLoading, checkScroll, panelMode])

  useEffect(() => {
    const el = chatBodyRef.current
    if (el && (chatMessages.length > 0 || chatLoading)) {
      el.scrollTop = el.scrollHeight
      checkScroll()
    }
  }, [chatMessages, chatLoading, checkScroll])

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      window.setTimeout(() => setCopiedIndex(null), 1500)
    } catch {
      // clipboard unavailable
    }
  }

  const scrollToBottom = () => {
    const el = chatBodyRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
      setShowScrollDown(false)
    }
  }

  const handleBack = () => {
    setPanelMode('bar')
  }

  const toggleFollow = async () => {
    playUiToggle()
    const result = (await window.electronAPI.invoke('overlay:toggle-follow')) as {
      enabled?: boolean
    }
    if (typeof result?.enabled === 'boolean') {
      setFollowEnabled(result.enabled)
    }
  }

  const toggleStealth = async () => {
    playUiToggle()
    const next = !stealthEnabled
    setStealthEnabled(next)
    setStealthFlash(true)
    window.setTimeout(() => setStealthFlash(false), 600)
    try {
      const result = (await window.electronAPI.invoke('overlay:toggle-protection', {
        enabled: next,
      })) as { enabled?: boolean }
      if (typeof result?.enabled === 'boolean') {
        setStealthEnabled(result.enabled)
      }
      if (tourStep === 'stealth') {
        void window.electronAPI.invoke('onboarding:tutorial-signal', { type: 'stealth' })
      }
    } catch {
      setStealthEnabled(!next)
    }
  }

  const toggleDictation = async () => {
    playUiToggle()
    const next = !dictationEnabled
    setDictationEnabled(next)
    try {
      const result = (await window.electronAPI.invoke('dictation:set-enabled', {
        enabled: next,
      })) as { enabled?: boolean }
      if (typeof result?.enabled === 'boolean') {
        setDictationEnabled(result.enabled)
      }
    } catch {
      setDictationEnabled(!next)
    }
  }

  const toggleScreenContext = async () => {
    playUiToggle()
    const next = !screenContextEnabled
    setScreenContextEnabled(next)
    try {
      const result = (await window.electronAPI.invoke('screen:context-enabled', next)) as {
        enabled?: boolean
      }
      if (typeof result?.enabled === 'boolean') {
        setScreenContextEnabled(result.enabled)
        if (result.enabled && tourStep === 'screen') {
          void window.electronAPI.invoke('onboarding:tutorial-signal', { type: 'screen' })
        }
      }
    } catch {
      setScreenContextEnabled(!next)
    }
  }

  const getMicRms = useCallback(() => {
    const analyser = micAnalyserRef.current
    if (!analyser) return 0
    const buf = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(buf)
    let sum = 0
    for (let i = 0; i < buf.length; i += 1) {
      sum += buf[i] * buf[i]
    }
    return Math.sqrt(sum / buf.length)
  }, [])

  const teardownMicAnalyser = useCallback(() => {
    if (micSpeechCheckRef.current) {
      window.clearInterval(micSpeechCheckRef.current)
      micSpeechCheckRef.current = null
    }
    void micAudioContextRef.current?.close()
    micAudioContextRef.current = null
    micAnalyserRef.current = null
    micSegmentMaxRmsRef.current = 0
  }, [])

  const setupMicAnalyser = useCallback(
    (stream: MediaStream) => {
      teardownMicAnalyser()
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      micAudioContextRef.current = ctx
      micAnalyserRef.current = analyser
    },
    [teardownMicAnalyser],
  )

  const stopMicCapture = () => {
    isCapturingRef.current = false
    if (micSegmentTimerRef.current) {
      window.clearTimeout(micSegmentTimerRef.current)
      micSegmentTimerRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch {
        // Recorder may already be stopped between segments.
      }
    }
    mediaRecorderRef.current = null
    teardownMicAnalyser()
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  const pauseMicCapture = () => {
    isCapturingRef.current = false
    if (micSegmentTimerRef.current) {
      window.clearTimeout(micSegmentTimerRef.current)
      micSegmentTimerRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch {
        // Recorder may already be stopped between segments.
      }
    }
    mediaRecorderRef.current = null
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = false
    })
  }

  const resumeMicCapture = () => {
    if (!streamRef.current) return
    isCapturingRef.current = true
    streamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = true
    })
    beginMicSegment(streamRef.current, mimeTypeRef.current)
  }

  const beginMicSegment = (stream: MediaStream, mimeType: string) => {
    if (!isCapturingRef.current) return

    const mediaRecorder = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = mediaRecorder
    micSegmentMaxRmsRef.current = 0
    micSegmentStartedAtRef.current = Date.now()
    micSilentMsRef.current = 0

    if (micSpeechCheckRef.current) {
      window.clearInterval(micSpeechCheckRef.current)
    }
    micSpeechCheckRef.current = window.setInterval(() => {
      const rms = getMicRms()
      if (rms > micSegmentMaxRmsRef.current) {
        micSegmentMaxRmsRef.current = rms
      }

      const segmentAge = Date.now() - micSegmentStartedAtRef.current
      if (segmentAge < MIC_SEGMENT_MIN_MS) return

      if (rms < MIC_SILENCE_RMS) {
        micSilentMsRef.current += 150
      } else {
        micSilentMsRef.current = 0
      }

      const hadSpeech = micSegmentMaxRmsRef.current >= MIC_SPEECH_RMS_MIN
      if (
        hadSpeech &&
        micSilentMsRef.current >= MIC_SILENCE_MS &&
        mediaRecorder.state === 'recording'
      ) {
        mediaRecorder.stop()
      }
    }, 150)

    mediaRecorder.ondataavailable = async (event) => {
      if (!isCapturingRef.current || event.data.size < 500) return
      if (micSpeechCheckRef.current) {
        window.clearInterval(micSpeechCheckRef.current)
        micSpeechCheckRef.current = null
      }
      const segmentRms = Math.max(micSegmentMaxRmsRef.current, getMicRms())
      micSegmentMaxRmsRef.current = 0
      if (segmentRms < MIC_SPEECH_RMS_MIN) return

      const arrayBuffer = await event.data.arrayBuffer()
      const base64 = arrayBufferToBase64(arrayBuffer)
      void window.electronAPI.invoke('audio:chunk', {
        base64,
        source: 'mic',
        rms: segmentRms,
      })
    }

    mediaRecorder.onstop = () => {
      if (isCapturingRef.current) {
        beginMicSegment(stream, mimeType)
      }
    }

    mediaRecorder.start()

    micSegmentTimerRef.current = window.setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop()
      }
    }, MIC_SEGMENT_MS)
  }

  const startRecording = async () => {
    if (needsConnect) {
      setStatus('Connect your account on the website first')
      return
    }

    try {
      const audioPrefs = (await window.electronAPI.invoke('audio:prefs-load')) as {
        preferredMicrophoneId?: string
        transcriptionMode?: 'dual' | 'group'
      }
      let transcriptionMode = audioPrefs?.transcriptionMode ?? 'dual'
      const deviceId = audioPrefs?.preferredMicrophoneId?.trim()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
      })

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      streamRef.current = stream
      mimeTypeRef.current = mimeType
      setupMicAnalyser(stream)
      await window.electronAPI.invoke('audio:start')
      setTranscriptionActivity('listening')
      setTranscript([])
      setFullTranscript([])
      setSuggestions([])
      setLiveActions([])
      setLiveAssistError('')
      setSessionInsights(null)
      setSessionRecap(null)
      setShowLiveInsights(true)
      setTranscriptSearch('')
      setLiveSpeakerLabels({})
      setSessionStartedAt(Date.now())
      setTranscriptionMode(transcriptionMode)
      setIsRecording(true)
      setIsPaused(false)
      isCapturingRef.current = true
      beginMicSegment(stream, mimeType)
      setPanelMode('bar')
      setSessionReply('')
      setStatus('Listening…')
    } catch (err) {
      console.error('Mic error:', err)
      stopMicCapture()
      setStatus('Microphone access denied')
      setPanelMode('bar')
    }
  }

  const runSessionAnalysis = useCallback(async () => {
    setInsightsLoading(true)
    try {
      const insights = (await window.electronAPI.invoke(
        'llm:session-analyze',
      )) as LiveSessionInsights | null
      if (insights) {
        setSessionInsights(insights)
      }
    } finally {
      setInsightsLoading(false)
    }
  }, [])

  const pauseSession = async () => {
    pauseMicCapture()
    await window.electronAPI.invoke('audio:pause')
    setIsPaused(true)
    setStatus('Paused')
  }

  const resumeSession = async () => {
    await window.electronAPI.invoke('audio:resume')
    resumeMicCapture()
    setIsPaused(false)
    setStatus('Listening…')
  }

  const togglePauseSession = () => {
    playUiClick()
    if (isPaused) {
      void resumeSession()
    } else {
      void pauseSession()
    }
  }

  const stopRecording = async () => {
    stopMicCapture()
    await window.electronAPI.invoke('audio:stop')
    setIsRecording(false)
    setIsPaused(false)
    setStatus('')
    setPanelMode('bar')
    setSessionReply('')
    try {
      const transcriptEntries = (await window.electronAPI.invoke(
        'audio:session-transcript',
      )) as TranscriptEntry[]
      let speakerLabels: SpeakerLabels = {}
      if (transcriptionMode === 'group') {
        try {
          speakerLabels =
            ((await window.electronAPI.invoke('llm:infer-speaker-labels')) as SpeakerLabels) ?? {}
        } catch {
          speakerLabels = {}
        }
        setLiveSpeakerLabels(speakerLabels)
      }

      let recap: SessionRecap | null = null
      try {
        recap = (await window.electronAPI.invoke('llm:session-recap')) as SessionRecap | null
      } catch (err) {
        console.error('Session recap failed:', err)
      }
      setSessionRecap(recap)

      const storedSession: StoredAudioSession = {
        id: crypto.randomUUID(),
        title: generateAudioSessionTitle(
          recap,
          sessionStartedAt,
          Array.isArray(transcriptEntries) ? transcriptEntries : [],
        ),
        createdAt: sessionStartedAt ?? Date.now(),
        endedAt: Date.now(),
        transcript: Array.isArray(transcriptEntries) ? transcriptEntries : [],
        recap,
        chatMessages: [],
        speakerLabels: Object.keys(speakerLabels).length > 0 ? speakerLabels : undefined,
      }

      try {
        const saveResult = (await window.electronAPI.invoke('audio-sessions:save', {
          session: storedSession,
        })) as { sessions?: StoredAudioSession[] }
        if (Array.isArray(saveResult?.sessions)) {
          const saved = saveResult.sessions.find((s) => s.id === storedSession.id)
          setViewingAudioSession(saved ?? storedSession)
        } else {
          setViewingAudioSession(storedSession)
        }

      } catch (err) {
        console.error('Failed to save audio session:', err)
        setViewingAudioSession(storedSession)
      }
      setAudioSessionChatMessages([])

      const lines = (Array.isArray(transcriptEntries) ? transcriptEntries : []).map(
        (e) => `${e.speaker}: ${e.text}`,
      )
      if (lines.length > 0) {
        void window.electronAPI.invoke('proactive:summarise-transcript', { lines })
      }
    } catch (err) {
      console.error('Stop recording cleanup failed:', err)
    }
  }

  const activeSpeakerLabels: SpeakerLabels =
    viewingAudioSession?.speakerLabels ?? liveSpeakerLabels

  const toggleRecording = () => {
    playUiToggle()
    if (isRecording) {
      void stopRecording()
    } else {
      void startRecording()
    }
  }

  const closeDropdownToNewChat = useCallback(() => {
    handleNewChat()
  }, [handleNewChat])

  const toggleHistory = () => {
    if (chatLoading || isRecording || isSessionRecap) return
    playUiClick()
    if (panelMode === 'history') {
      closeDropdownToNewChat()
      return
    }
    setPanelMode('history')
  }

  const reopenChat = () => {
    if (hasActiveChat) {
      setPanelMode('chat')
    }
  }

  const openFullHistory = () => {
    void window.electronAPI.invoke('settings:open', { tab: 'history' })
    setPanelMode('bar')
  }

  const openAudioSession = useCallback((session: StoredAudioSession) => {
    setViewingAudioSession(session)
    setAudioSessionChatMessages(session.chatMessages ?? [])
    setAudioSessionChatStatus('')
    setPanelMode('audio_session_detail')
  }, [])

  useEffect(() => {
    window.electronAPI.on('audio-sessions:open', (session) => {
      const data = session as StoredAudioSession
      if (data?.id && Array.isArray(data.transcript)) {
        openAudioSession(data)
      }
    })
  }, [openAudioSession])

  useEffect(() => {
    if (!isRecording) return

    const initialTimer = window.setTimeout(() => {
      void runSessionAnalysis()
    }, 15_000)

    const interval = window.setInterval(() => {
      void runSessionAnalysis()
    }, 60_000)

    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(interval)
    }
  }, [isRecording, runSessionAnalysis])

  const keybindActionsRef = useRef({
    handleNewChat,
    toggleRecording,
    toggleHistory,
  })
  keybindActionsRef.current = { handleNewChat, toggleRecording, toggleHistory }

  useEffect(() => {
    window.electronAPI.on('keybind:action', (payload) => {
      const action = (payload as { action?: string }).action
      const actions = keybindActionsRef.current
      switch (action) {
        case 'submit': {
          const form = document.querySelector('.session-composer') as HTMLFormElement | null
          form?.requestSubmit()
          break
        }
        case 'new_chat':
          actions.handleNewChat()
          break
        case 'toggle_recording':
          actions.toggleRecording()
          break
        case 'toggle_history':
          actions.toggleHistory()
          break
        default:
          break
      }
    })
  }, [])

  const submitSessionQuery = async (message: string) => {
    if (!message.trim() || sessionLoading || needsConnect) return

    setSessionLoading(true)
    setSessionReply('')

    try {
      const contextEntries = fullTranscript.length > 0 ? fullTranscript : transcript
      const contextTranscript = entriesToDisplayLines(contextEntries, activeSpeakerLabels)

      const result = (await window.electronAPI.invoke('llm:chat', {
        message: message.trim(),
        transcriptLines: contextTranscript,
        useScreenContext: screenContextEnabled,
      })) as {
        reply?: string
        error?: string
      }

      if (result.error === 'rate_limit' || result.error === 'rate_limit_exceeded') {
        setSessionReply('Usage limit reached — try again later')
      } else if (result.error === 'auth_expired' || result.error === 'not_authenticated') {
        setConnectionState('needs_connect')
        setSessionReply('Account not connected. Connect on the website while signed in.')
      } else if (result.error === 'api_key_missing') {
        setSessionReply('API key not configured for the active model.')
      } else if (result.reply) {
        setSessionReply(result.reply)
      } else {
        setSessionReply('Could not get a reply — try again.')
      }
    } catch (err) {
      console.error('Session query error:', err)
      setSessionReply('Something went wrong. Please try again.')
    } finally {
      setSessionLoading(false)
    }
  }

  const runRecap = async () => {
    if (needsConnect) {
      setSessionReply('Connect your account on the website first.')
      return
    }

    setSessionLoading(true)
    setSessionReply('')
    try {
      const recap = (await window.electronAPI.invoke('llm:session-recap')) as SessionRecap | null
      setSessionReply(recap?.summary?.trim() || 'No recap yet — keep recording.')
    } catch {
      setSessionReply('Recap is temporarily unavailable.')
    } finally {
      setSessionLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || sessionLoading || chatLoading) return
    if (needsConnect) {
      setStatus('Connect your account on the website first')
      return
    }

    const message = query.trim()
    setQuery('')

    if (tourStep === 'enter') {
      void window.electronAPI.invoke('onboarding:tutorial-signal', { type: 'enter' })
    }

    if (isRecording) {
      await submitSessionQuery(message)
      return
    }

    setPanelMode('chat')
    setChatLoading(true)
    setChatStatus('Thinking...')

    let sessionId = activeSessionId
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      setActiveSessionId(sessionId)
    }

    const userMessage: ChatMessage = { role: 'user', content: message }
    const messagesWithUser = [...chatMessages, userMessage]
    setChatMessages(messagesWithUser)
    void persistSession(sessionId, messagesWithUser)

    try {
      const contextEntries = fullTranscript.length > 0 ? fullTranscript : transcript
      const contextTranscript = entriesToDisplayLines(contextEntries, activeSpeakerLabels)

      const result = (await window.electronAPI.invoke('llm:chat', {
        message,
        transcriptLines: contextTranscript,
        useScreenContext: screenContextEnabled,
      })) as { reply?: string; error?: string }

      let assistantMessage: ChatMessage | null = null

      if (result.error === 'rate_limit' || result.error === 'rate_limit_exceeded') {
        setChatStatus('Usage limit reached — try again later')
        assistantMessage = { role: 'assistant', content: 'Usage limit reached — try again later' }
      } else if (result.error === 'auth_expired' || result.error === 'not_authenticated') {
        setChatStatus('Account not connected — connect again on the website')
        setConnectionState('needs_connect')
        assistantMessage = {
          role: 'assistant',
          content: 'Account not connected. Connect on the website while signed in.',
        }
      } else if (result.error === 'api_key_missing') {
        setChatStatus('API key not configured')
        assistantMessage = { role: 'assistant', content: 'API key not configured for the active model.' }
      } else if (result.error === 'permission_denied') {
        setChatStatus('Screen recording permission required')
        assistantMessage = {
          role: 'assistant',
          content: 'Screen recording permission required — enable in System Settings',
        }
      } else if (result.error === 'capture_failed') {
        setChatStatus('Could not capture screen')
        assistantMessage = { role: 'assistant', content: 'Could not capture screen — try again' }
      } else if (result.error === 'chat_failed') {
        setChatStatus('Chat request failed')
        assistantMessage = { role: 'assistant', content: 'Chat request failed — try again' }
      } else if (result.error === 'empty_reply') {
        setChatStatus('No reply received')
        assistantMessage = { role: 'assistant', content: 'No reply received' }
      } else if (result.reply) {
        assistantMessage = {
          role: 'assistant',
          content: result.reply,
          usedScreen: screenContextEnabled,
        }
        setChatStatus('')
      } else {
        setChatStatus('Could not get a reply')
        assistantMessage = { role: 'assistant', content: 'Could not get a reply — try again.' }
      }

      if (assistantMessage && sessionId) {
        const fullMessages = [...messagesWithUser, assistantMessage]
        setChatMessages(fullMessages)
        void persistSession(sessionId, fullMessages)
      }
    } catch (err) {
      console.error('Chat error:', err)
      setChatStatus('Chat failed')
      if (sessionId) {
        const fullMessages = [
          ...messagesWithUser,
          { role: 'assistant' as const, content: 'Something went wrong. Please try again.' },
        ]
        setChatMessages(fullMessages)
        void persistSession(sessionId, fullMessages)
      }
    } finally {
      setChatLoading(false)
    }
  }

  const renderConnectBanner = () => {
    if (!needsConnect) return null

    return (
      <div className="connect-banner">
        <div className="connect-banner-text">
          <span className="connect-banner-title">Connect your account</span>
          <span className="connect-banner-sub">
            Sign in on the website, then click Open Clarifi to link this app automatically.
          </span>
        </div>
        <button type="button" className="connect-banner-btn" onClick={() => void openConnectPage()}>
          Open on website
        </button>
        {connectError && <span className="connect-banner-error">{connectError}</span>}
      </div>
    )
  }

  const activeModel =
    prefs?.models.find((m) => m.id === prefs?.activeModelId) ?? prefs?.models[0] ?? null
  const activeMode =
    prefs?.modes.find((m) => m.id === prefs?.activeModeId) ?? prefs?.modes[0] ?? null
  const openSettings = (
    tab: 'profile' | 'models' | 'modes' | 'integrations' | 'keybinds' | 'audio' = 'profile',
  ) => {
    void window.electronAPI.invoke('settings:open', { tab })
  }

  const renderHistoryDropdown = () => (
    <div className="overlay-expanded overlay-expanded-history">
      {status && <div className="overlay-status">{status}</div>}

      {activeChatSessions.length > 0 && (
        <div className="expanded-section">
          <div className="expanded-label">Chats</div>
          {hasActiveChat && panelMode === 'history' && (
            <button type="button" className="history-continue-btn" onClick={reopenChat}>
              Continue chat
            </button>
          )}
          {recentChatSessions.map((session) => {
            const isActive = session.id === activeSessionId
            return (
              <button
                key={session.id}
                type="button"
                className={`history-session-row ${isActive ? 'history-session-row--active' : ''}`}
                onClick={() => loadSession(session)}
              >
                <span className="history-session-title">{session.title}</span>
                <span className="history-session-meta">
                  <span className="history-session-time">
                    {formatRelativeTime(session.createdAt)}
                  </span>
                  <span
                    className={`history-session-badge ${isActive ? 'history-session-badge--active' : ''}`}
                  >
                    {isActive ? 'Active' : 'Resume'}
                  </span>
                </span>
              </button>
            )
          })}
          {(hasMoreChatHistory || activeChatSessions.length > 0) && (
            <button type="button" className="history-view-all-btn" onClick={openFullHistory}>
              View full history
            </button>
          )}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="expanded-section">
          <div className="expanded-label">Suggestions</div>
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="overlay-suggestion"
              style={{ background: typeColors[s.type] }}
            >
              <span className="suggestion-icon">{typeLabels[s.type]}</span>
              <span className="suggestion-text">{s.text}</span>
            </div>
          ))}
        </div>
      )}

      {transcript.length > 0 && (
        <div className="expanded-section">
          <div className="expanded-label">Transcript</div>
          {transcript.slice(-8).map((entry) => (
            <p key={entry.id} className="history-transcript-line">
              <strong>{entry.speaker}:</strong> {entry.text}
            </p>
          ))}
        </div>
      )}

      {isRecording &&
        suggestions.length === 0 &&
        transcript.length === 0 &&
        chatMessages.length === 0 &&
        allChatSessions.length === 0 && (
          <div className="overlay-empty">
            {status === 'Transcribing...' ? 'Transcribing...' : 'Listening... speak now'}
          </div>
        )}

      {!isRecording && !hasAnyHistory && (
        <div className="overlay-empty">No history yet</div>
      )}
    </div>
  )

  const renderToolbar = () => (
    <div className={`overlay-toolbar${tourHighlight('toolbar')}`}>
      <div className="toolbar-left">
        <div
          className={`overlay-dot ${isRecording ? (isPaused ? 'paused' : 'recording') : ''}`}
        />
        <button
          type="button"
          className="toolbar-brand toolbar-brand-btn"
          onClick={() => openSettings('profile')}
        >
          Clarifi
        </button>

        {prefs?.showModelInToolbar && (
          <div className="toolbar-model-wrap" ref={modelMenuRef}>
            <button
              type="button"
              className={`toolbar-pill ${modelMenuOpen ? 'active' : ''}`}
              onClick={() => setModelMenuOpen((open) => !open)}
            >
              <span className="toolbar-pill-label">
                {activeModel?.provider === 'anthropic'
                  ? anthropicShortLabel(activeModel.label)
                  : (activeModel?.label ?? 'Model')}
              </span>
              <span className="chevron">▼</span>
            </button>
            {modelMenuOpen && (
              <div className="toolbar-model-menu">
                <button
                  type="button"
                  className="toolbar-model-item"
                  onClick={() => {
                    setModelMenuOpen(false)
                    openSettings('models')
                  }}
                >
                  All models
                </button>
              </div>
            )}
          </div>
        )}

        <ToolbarTooltip label="Change mode & system prompt">
          <button
            type="button"
            className={`toolbar-pill toolbar-mode-btn${tourHighlight('mode')}`}
            onClick={() => openSettings('modes')}
          >
            <span className="toolbar-pill-label">{activeMode?.label ?? 'Mode'}</span>
          </button>
        </ToolbarTooltip>

        <ToolbarTooltip label="Uses Screen">
          <button
            type="button"
            className={`toolbar-icon ${screenContextEnabled ? 'active' : ''}${tourHighlight('screen')}`}
            onClick={() => void toggleScreenContext()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </button>
        </ToolbarTooltip>

        <ToolbarTooltip label={stealthEnabled ? 'Hidden from screen share' : 'Visible on screen share'}>
          <button
            type="button"
            className={`toolbar-icon stealth-btn ${stealthEnabled ? 'active' : ''}${tourHighlight('stealth')}`}
            aria-pressed={stealthEnabled}
            aria-label={stealthEnabled ? 'Hidden from screen share' : 'Visible on screen share'}
            onClick={() => void toggleStealth()}
          >
            {stealthEnabled ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </ToolbarTooltip>

        <ToolbarTooltip label={followEnabled ? 'Follow screen' : 'Pinned position'}>
          <button
            type="button"
            className={`toolbar-icon ${followEnabled ? 'active' : ''}`}
            onClick={() => void toggleFollow()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>
        </ToolbarTooltip>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-right">
        {isRecording && (
          <ToolbarTooltip label={isPaused ? 'Resume session' : 'Pause session'}>
            <button
              type="button"
              className={`toolbar-icon pause-btn ${isPaused ? 'paused' : ''}`}
              onClick={togglePauseSession}
            >
              {isPaused ? '▶' : '⏸'}
            </button>
          </ToolbarTooltip>
        )}

        <ToolbarTooltip label={dictationEnabled ? 'Dictation on' : 'Dictation off'}>
          <button
            type="button"
            className={`toolbar-icon dictation-btn ${dictationEnabled ? 'active' : ''}`}
            aria-pressed={dictationEnabled}
            aria-label={dictationEnabled ? 'Dictation on' : 'Dictation off'}
            onClick={() => void toggleDictation()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </button>
        </ToolbarTooltip>

        <ToolbarTooltip
          label={isRecording ? 'Stop Audio Session' : 'Start Audio Session'}
        >
          <button
            type="button"
            className={`toolbar-icon audio-btn ${isRecording ? 'active' : ''}${tourHighlight('audio')}`}
            onClick={toggleRecording}
            disabled={needsConnect}
          >
            <span
              className={`waveform ${isRecording && !isPaused ? 'waveform-active' : ''}`}
            >
              <span />
              <span />
              <span />
              <span />
            </span>
          </button>
        </ToolbarTooltip>

        {(hasActiveChat || panelMode === 'chat') && (
          <button
            type="button"
            className="toolbar-new-chat"
            onClick={() => {
              playUiClick()
              handleNewChat()
            }}
          >
            New Chat
          </button>
        )}

        <ToolbarTooltip label="History">
          <button
            type="button"
            className={`toolbar-history ${panelMode === 'history' ? 'active' : ''}${tourHighlight('sessions')}`}
            onClick={toggleHistory}
          >
            <span>History</span>
            <span className={`chevron ${panelMode === 'history' ? 'chevron-up' : ''}`}>▼</span>
          </button>
        </ToolbarTooltip>
      </div>
    </div>
  )

  return (
    <div
      className={`overlay-root ${isChatPanel ? 'overlay-root-chat' : 'overlay-root-simple'}`}
      onMouseDown={() => {
        void window.electronAPI.invoke('overlay:set-interactive', true)
      }}
    >
      <ResizeHandles onResize={applyBounds} />
      {isChatPanel ? (
        <OverlayChatPanel
          query={query}
          onQueryChange={setQuery}
          onSubmit={(e) => void handleSubmit(e)}
          onBack={handleBack}
          messages={chatMessages}
          loading={chatLoading}
          status={chatStatus}
          screenContextEnabled={screenContextEnabled}
          chatBodyRef={chatBodyRef}
          showScrollDown={showScrollDown}
          onScrollDown={scrollToBottom}
          onCopy={(text, i) => void copyToClipboard(text, i)}
          copiedIndex={copiedIndex}
          tourHighlight={tourHighlight('chat')}
          toolbar={renderToolbar()}
          onBackClickSound={playUiClick}
          onSubmitClickSound={playUiClick}
        />
      ) : (
        <div
          className={`overlay-bar overlay-bar-simple${stealthEnabled ? ' overlay-stealth-active' : ''}${stealthFlash ? ' overlay-stealth-flash' : ''}`}
        >
          {renderConnectBanner()}
          <RecordingSessionCard
            isRecording={isRecording}
            isPaused={isPaused}
            query={query}
            onQueryChange={setQuery}
            onSubmit={(e) => void handleSubmit(e)}
            screenContextEnabled={screenContextEnabled}
            loading={sessionLoading}
            reply={sessionReply}
            disabled={needsConnect}
            transcript={fullTranscript.length > 0 ? fullTranscript : transcript}
            transcriptionActivity={transcriptionActivity}
            liveActions={liveActions}
            assistError={liveAssistError}
            onRecap={() => void runRecap()}
          />
          {renderToolbar()}
        </div>
      )}
      {isDropdownPanel && renderHistoryDropdown()}
    </div>
  )
}
