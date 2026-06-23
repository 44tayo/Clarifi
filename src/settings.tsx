import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ANTHROPIC_LEGACY_DIVIDER_BEFORE,
  sortAnthropicModels,
} from './lib/anthropic-models'
import { acceleratorToKeyLabels, keyboardEventToAccelerator } from './lib/keybindDisplay'
import { ProactiveSettingsPanel } from './components/ProactiveSettingsPanel'
import './settings.css'

type ModelProvider = 'anthropic' | 'openai' | 'gemini' | 'groq' | 'custom'

type ModelConfig = {
  id: string
  label: string
  provider: ModelProvider
  modelId: string
  builtin?: boolean
}

type ModeConfig = {
  id: string
  label: string
  category?: string
  systemPrompt: string
  isActive: boolean
  builtin?: boolean
}

type PublicPreferences = {
  activeModelId: string
  models: ModelConfig[]
  activeModeId: string
  modes: ModeConfig[]
  showModelInToolbar: boolean
  productKnowledge: string
  workKnowledge: string
  generalKnowledge: string
}

type SettingsTab =
  | 'profile'
  | 'models'
  | 'modes'
  | 'integrations'
  | 'keybinds'
  | 'audio'
  | 'audio_sessions'
  | 'history'
  | 'productivity'

type StoredAudioSession = {
  id: string
  title: string
  createdAt: number
  endedAt: number
  transcript: Array<{ id: string; text: string; source: string; speaker?: string; at: number }>
  recap: {
    summary: string
    highlights: string[]
    actionItems: string[]
    openQuestions: string[]
    recapEmailDraft: string
  } | null
  chatMessages: Array<{ role: string; content: string }>
}

type ChatSession = {
  id: string
  title: string
  createdAt: number
  messages: { role: string; content: string }[]
  archived?: boolean
}

type HistoryFilter = 'all' | 'active' | 'archived'

type ConnectedAccount = {
  provider: string
  label: string
  email?: string
}

type DeviceProfile = {
  paired: boolean
  userId?: string
  email?: string
  firstName?: string
  lastName?: string
  fullName?: string
  avatarUrl?: string
  localAvatarUrl?: string
  connectedAccounts?: ConnectedAccount[]
  plan?: string
  planLabel?: string
  sessionsToday?: number
  sessionsLimit?: number | null
}

const AVATAR_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#0ea5e9', '#f59e0b']

function profileInitials(profile: DeviceProfile): string {
  const first = profile.firstName?.trim()?.[0] ?? ''
  const last = profile.lastName?.trim()?.[0] ?? ''
  if (first || last) return `${first}${last}`.toUpperCase()
  const full = profile.fullName?.trim() || profile.email?.split('@')[0] || 'U'
  return full.slice(0, 1).toUpperCase()
}

function avatarColorSeed(profile: DeviceProfile): string {
  return profile.email ?? profile.fullName ?? profile.userId ?? 'user'
}

function avatarPlaceholderColor(profile: DeviceProfile): string {
  const seed = avatarColorSeed(profile)
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i)) % AVATAR_COLORS.length
  }
  return AVATAR_COLORS[hash]
}

function hasUploadedAvatar(profile: DeviceProfile): boolean {
  return Boolean(profile.localAvatarUrl?.startsWith('data:image/'))
}

async function resizeImageForAvatar(
  file: File,
  maxSize = 256,
): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas_unavailable')

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const mimeType = file.type.includes('png') ? 'image/png' : 'image/jpeg'
  const dataUrl = canvas.toDataURL(mimeType, mimeType === 'image/jpeg' ? 0.88 : undefined)
  const comma = dataUrl.indexOf(',')
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  return { base64, mimeType }
}

function ProfileAvatar({
  profile,
  large = false,
  draftFirstName,
  draftLastName,
}: {
  profile: DeviceProfile
  large?: boolean
  draftFirstName?: string
  draftLastName?: string
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const displayProfile: DeviceProfile =
    draftFirstName !== undefined || draftLastName !== undefined
      ? { ...profile, firstName: draftFirstName, lastName: draftLastName }
      : profile
  const showImage = hasUploadedAvatar(profile) && !imageFailed
  const sizeClass = large
    ? 'settings-profile-photo settings-profile-photo-lg'
    : 'settings-profile-photo'

  if (showImage && profile.localAvatarUrl) {
    return (
      <img
        src={profile.localAvatarUrl}
        alt=""
        className={sizeClass}
        onError={() => setImageFailed(true)}
      />
    )
  }

  return (
    <span
      className={`${sizeClass} settings-profile-photo-fallback`}
      style={{ backgroundColor: avatarPlaceholderColor(displayProfile) }}
    >
      {profileInitials(displayProfile)}
    </span>
  )
}

type PermissionState = {
  microphone: boolean
  screen: boolean
  accessibility: boolean
}

const SETTINGS_TABS: SettingsTab[] = [
  'profile',
  'models',
  'modes',
  'integrations',
  'keybinds',
  'audio',
  'audio_sessions',
  'history',
  'productivity',
]

const NAV_ITEMS: { id: SettingsTab; label: string; profile?: boolean }[] = [
  { id: 'profile', label: 'Profile', profile: true },
  { id: 'models', label: 'Models' },
  { id: 'modes', label: 'Modes' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'keybinds', label: 'Keybinds' },
  { id: 'audio', label: 'Audio' },
  { id: 'audio_sessions', label: 'Audio Sessions' },
  { id: 'history', label: 'History' },
  { id: 'productivity', label: 'Productivity' },
]

function formatHistoryTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

type KeybindActionId =
  | 'toggle_overlay'
  | 'submit'
  | 'new_chat'
  | 'move_up'
  | 'move_down'
  | 'move_left'
  | 'move_right'
  | 'toggle_recording'
  | 'toggle_history'
  | 'open_settings'
  | 'hold_to_dictate'

type KeybindDefinition = {
  id: KeybindActionId
  label: string
  description: string
  defaultAccelerator: string
}

type KeybindPreferences = Record<KeybindActionId, string>

type AudioPreferences = {
  transcriptionLanguage: string
  outputLanguage: string
  dictationLanguage: string
  dictationOutputLanguage: string
  preferredMicrophoneId: string
  preferredMicrophoneLabel: string
  systemAudioCapture: 'meeting' | 'display'
  transcriptionMode: 'dual' | 'group'
}

type MicDevice = {
  deviceId: string
  label: string
}

const TRANSCRIPTION_LANGUAGES = [
  { code: 'en', label: 'English (recommended)' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'auto', label: 'Auto-detect' },
]

const DICTATION_LANGUAGES = [
  { code: 'auto', label: 'Auto-detect (recommended for accents)' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
  { code: 'pl', label: 'Polish' },
  { code: 'tr', label: 'Turkish' },
  { code: 'ru', label: 'Russian' },
  { code: 'sv', label: 'Swedish' },
]

const DICTATION_OUTPUT_LANGUAGES = [
  { code: 'same', label: 'Same as spoken language' },
  ...DICTATION_LANGUAGES.filter((lang) => lang.code !== 'auto'),
]

const OUTPUT_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
  { code: 'pl', label: 'Polish' },
  { code: 'tr', label: 'Turkish' },
  { code: 'ru', label: 'Russian' },
  { code: 'sv', label: 'Swedish' },
]

function normalizeSettingsTab(value: unknown): SettingsTab | null {
  if (value === 'general') return 'models'
  if (typeof value === 'string' && SETTINGS_TABS.includes(value as SettingsTab)) {
    return value as SettingsTab
  }
  return null
}

function groupModesByCategory(modes: ModeConfig[]): Map<string, ModeConfig[]> {
  const map = new Map<string, ModeConfig[]>()
  for (const mode of modes) {
    const cat = mode.category || 'Other'
    const list = map.get(cat) ?? []
    list.push(mode)
    map.set(cat, list)
  }
  return map
}

const PROVIDER_ORDER: ModelProvider[] = ['anthropic', 'openai', 'gemini', 'groq', 'custom']

const PROVIDER_LABELS: Record<ModelProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  groq: 'Groq',
  custom: 'Custom',
}

function groupModelsByProvider(models: ModelConfig[]): Map<ModelProvider, ModelConfig[]> {
  const map = new Map<ModelProvider, ModelConfig[]>()
  for (const provider of PROVIDER_ORDER) {
    map.set(provider, [])
  }
  for (const model of models) {
    const list = map.get(model.provider) ?? []
    list.push(model)
    map.set(model.provider, list)
  }
  return map
}

export default function SettingsApp() {
  const [tab, setTab] = useState<SettingsTab>('profile')
  const [prefs, setPrefs] = useState<PublicPreferences | null>(null)
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [profile, setProfile] = useState<DeviceProfile | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [draftFirstName, setDraftFirstName] = useState('')
  const [draftLastName, setDraftLastName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [permissions, setPermissions] = useState<PermissionState | null>(null)
  const [showAddModel, setShowAddModel] = useState(false)
  const [expandedProviders, setExpandedProviders] = useState<Set<ModelProvider>>(
    () => new Set(['anthropic', 'openai', 'gemini']),
  )
  const [newModel, setNewModel] = useState({
    label: '',
    provider: 'anthropic' as ModelProvider,
    modelId: '',
    apiKey: '',
  })
  const [audioPrefs, setAudioPrefs] = useState<AudioPreferences>({
    transcriptionLanguage: 'en',
    outputLanguage: 'en',
    dictationLanguage: 'auto',
    dictationOutputLanguage: 'same',
    preferredMicrophoneId: '',
    preferredMicrophoneLabel: '',
    systemAudioCapture: 'meeting',
    transcriptionMode: 'dual',
  })
  const [micDevices, setMicDevices] = useState<MicDevice[]>([])
  const [testMicStatus, setTestMicStatus] = useState<
    'idle' | 'testing' | 'success' | 'no-signal' | 'error'
  >('idle')
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [audioSessions, setAudioSessions] = useState<StoredAudioSession[]>([])
  const [audioRenamingId, setAudioRenamingId] = useState<string | null>(null)
  const [audioRenameDraft, setAudioRenameDraft] = useState('')
  const [keybindDefinitions, setKeybindDefinitions] = useState<KeybindDefinition[]>([])
  const [keybindAccelerators, setKeybindAccelerators] = useState<KeybindPreferences | null>(null)
  const [recordingKeybindId, setRecordingKeybindId] = useState<KeybindActionId | null>(null)
  const [keybindError, setKeybindError] = useState('')
  const [workKnowledgeDraft, setWorkKnowledgeDraft] = useState('')
  const [workKnowledgeSaving, setWorkKnowledgeSaving] = useState(false)
  const [workKnowledgeSaved, setWorkKnowledgeSaved] = useState(false)
  const [generalKnowledgeDraft, setGeneralKnowledgeDraft] = useState('')
  const [generalKnowledgeSaving, setGeneralKnowledgeSaving] = useState(false)
  const [generalKnowledgeSaved, setGeneralKnowledgeSaved] = useState(false)

  const loadPrefs = useCallback(async () => {
    setPrefsLoading(true)
    try {
      const data = (await window.electronAPI.invoke('prefs:load')) as PublicPreferences
      setPrefs(data)
      setWorkKnowledgeDraft(data.workKnowledge ?? '')
      setGeneralKnowledgeDraft(data.generalKnowledge ?? '')
    } finally {
      setPrefsLoading(false)
    }
  }, [])

  const loadProfile = useCallback(async () => {
    const data = (await window.electronAPI.invoke('settings:profile')) as DeviceProfile
    setProfile(data)
    setDraftFirstName(data.firstName ?? '')
    setDraftLastName(data.lastName ?? '')
  }, [])

  const loadPermissions = useCallback(async () => {
    const data = (await window.electronAPI.invoke('permissions:status')) as PermissionState
    setPermissions(data)
  }, [])

  const loadAudioPrefs = useCallback(async () => {
    const data = (await window.electronAPI.invoke('audio:prefs-load')) as AudioPreferences
    setAudioPrefs(data)
  }, [])

  const loadChatHistory = useCallback(async () => {
    const data = (await window.electronAPI.invoke('chat:history-load')) as { sessions?: ChatSession[] }
    if (Array.isArray(data?.sessions)) {
      setChatSessions(data.sessions)
    }
  }, [])

  const loadAudioSessions = useCallback(async () => {
    const data = (await window.electronAPI.invoke('audio-sessions:load')) as {
      sessions?: StoredAudioSession[]
    }
    if (Array.isArray(data?.sessions)) {
      setAudioSessions(data.sessions)
    }
  }, [])

  const applyKeybindPrefs = useCallback((data: { definitions?: KeybindDefinition[]; accelerators?: KeybindPreferences }) => {
    if (Array.isArray(data?.definitions)) {
      setKeybindDefinitions(data.definitions)
    }
    if (data?.accelerators) {
      setKeybindAccelerators(data.accelerators)
    }
  }, [])

  const loadKeybindPrefs = useCallback(async () => {
    const data = (await window.electronAPI.invoke('keybinds:prefs-load')) as {
      definitions?: KeybindDefinition[]
      accelerators?: KeybindPreferences
    }
    applyKeybindPrefs(data)
  }, [applyKeybindPrefs])

  const refreshMicDevices = useCallback(async () => {
    try {
      if (!permissions?.microphone) {
        await window.electronAPI.invoke('permissions:request', { kind: 'microphone' })
        await loadPermissions()
      }
      const devices = await navigator.mediaDevices.enumerateDevices()
      const inputs = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || 'Microphone',
        }))
      setMicDevices(inputs)
    } catch (err) {
      console.error('Failed to enumerate microphones:', err)
    }
  }, [permissions?.microphone, loadPermissions])

  useEffect(() => {
    void loadPrefs()
    void loadProfile()
    void loadPermissions()
    void loadAudioPrefs()
    void loadChatHistory()
    void loadAudioSessions()
    void loadKeybindPrefs()

    const params = new URLSearchParams(window.location.search)
    const initialTab = normalizeSettingsTab(params.get('tab'))
    if (initialTab) {
      setTab(initialTab)
    }

    window.electronAPI.on('settings:tab', (nextTab) => {
      const tab = normalizeSettingsTab(nextTab)
      if (tab) {
        setTab(tab)
      }
    })
    window.electronAPI.on('audio:prefs-changed', (next) => {
      setAudioPrefs(next as AudioPreferences)
    })
    window.electronAPI.on('chat:history-changed', (payload) => {
      const data = payload as { sessions?: ChatSession[] }
      if (Array.isArray(data?.sessions)) {
        setChatSessions(data.sessions)
      }
    })
    window.electronAPI.on('audio-sessions:changed', (payload) => {
      const data = payload as { sessions?: StoredAudioSession[] }
      if (Array.isArray(data?.sessions)) {
        setAudioSessions(data.sessions)
      }
    })
    window.electronAPI.on('keybinds:prefs-changed', (payload) => {
      applyKeybindPrefs(payload as { definitions?: KeybindDefinition[]; accelerators?: KeybindPreferences })
    })
    window.electronAPI.on('prefs:changed', (next) => {
      const data = next as PublicPreferences
      setPrefs(data)
      setWorkKnowledgeDraft(data.workKnowledge ?? '')
      setGeneralKnowledgeDraft(data.generalKnowledge ?? '')
    })
    window.electronAPI.on('permissions:changed', (payload) => {
      setPermissions(payload as PermissionState)
    })
  }, [loadPrefs, loadProfile, loadPermissions, loadAudioPrefs, loadChatHistory, loadAudioSessions, loadKeybindPrefs, applyKeybindPrefs])

  useEffect(() => {
    if (!recordingKeybindId) return

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()

      if (event.key === 'Escape') {
        setRecordingKeybindId(null)
        setKeybindError('')
        return
      }

      const accelerator = keyboardEventToAccelerator(event)
      if (!accelerator) return

      void (async () => {
        try {
          const result = (await window.electronAPI.invoke('keybinds:prefs-save', {
            action: recordingKeybindId,
            accelerator,
          })) as { definitions?: KeybindDefinition[]; accelerators?: KeybindPreferences }
          applyKeybindPrefs(result)
          setRecordingKeybindId(null)
          setKeybindError('')
        } catch (err) {
          setKeybindError(err instanceof Error ? err.message : 'Could not save shortcut')
        }
      })()
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [recordingKeybindId, applyKeybindPrefs])

  useEffect(() => {
    if (tab === 'audio') {
      void refreshMicDevices()
    }
  }, [tab, refreshMicDevices])

  const modeGroups = useMemo(
    () => (prefs ? groupModesByCategory(prefs.modes) : new Map()),
    [prefs],
  )

  const modelGroups = useMemo(
    () => (prefs ? groupModelsByProvider(prefs.models) : new Map()),
    [prefs],
  )

  useEffect(() => {
    if (!prefs) return
    const active = prefs.models.find((m) => m.id === prefs.activeModelId)
    if (active) {
      setExpandedProviders((prev) => new Set([...prev, active.provider]))
    }
  }, [prefs?.activeModelId, prefs?.models])

  const toggleProvider = (provider: ModelProvider) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev)
      if (next.has(provider)) {
        next.delete(provider)
      } else {
        next.add(provider)
      }
      return next
    })
  }

  const activateMode = async (modeId: string) => {
    const data = (await window.electronAPI.invoke('prefs:set-active-mode', { modeId })) as PublicPreferences
    setPrefs(data)
  }

  const saveWorkKnowledge = async () => {
    setWorkKnowledgeSaving(true)
    setWorkKnowledgeSaved(false)
    try {
      const data = (await window.electronAPI.invoke('prefs:set-work-knowledge', {
        knowledge: workKnowledgeDraft,
      })) as PublicPreferences
      setPrefs(data)
      setWorkKnowledgeDraft(data.workKnowledge ?? '')
      setGeneralKnowledgeDraft(data.generalKnowledge ?? '')
      setWorkKnowledgeSaved(true)
      window.setTimeout(() => setWorkKnowledgeSaved(false), 2000)
    } finally {
      setWorkKnowledgeSaving(false)
    }
  }

  const saveGeneralKnowledge = async () => {
    setGeneralKnowledgeSaving(true)
    setGeneralKnowledgeSaved(false)
    try {
      const data = (await window.electronAPI.invoke('prefs:set-general-knowledge', {
        knowledge: generalKnowledgeDraft,
      })) as PublicPreferences
      setPrefs(data)
      setGeneralKnowledgeDraft(data.generalKnowledge ?? '')
      setGeneralKnowledgeSaved(true)
      window.setTimeout(() => setGeneralKnowledgeSaved(false), 2000)
    } finally {
      setGeneralKnowledgeSaving(false)
    }
  }

  const uploadWorkKnowledge = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.txt,.md,.csv,text/plain,text/markdown'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      if (file.size > 500 * 1024) return
      void file.text().then((text) => {
        setWorkKnowledgeDraft((prev) => {
          const trimmed = text.trim()
          if (!trimmed) return prev
          return prev.trim() ? `${prev.trim()}\n\n${trimmed}` : trimmed
        })
      })
    }
    input.click()
  }

  const uploadGeneralKnowledge = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.txt,.md,.csv,text/plain,text/markdown'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      if (file.size > 500 * 1024) return
      void file.text().then((text) => {
        setGeneralKnowledgeDraft((prev) => {
          const trimmed = text.trim()
          if (!trimmed) return prev
          return prev.trim() ? `${prev.trim()}\n\n${trimmed}` : trimmed
        })
      })
    }
    input.click()
  }

  const setActiveModel = async (modelId: string) => {
    const data = (await window.electronAPI.invoke('prefs:set-active-model', { modelId })) as PublicPreferences
    setPrefs(data)
  }

  const setShowModelInToolbar = async (show: boolean) => {
    const data = (await window.electronAPI.invoke('prefs:set-show-model-in-toolbar', {
      show,
    })) as PublicPreferences
    setPrefs(data)
  }

  const addModel = async () => {
    if (!newModel.modelId.trim() || !newModel.apiKey.trim()) return
    const data = (await window.electronAPI.invoke('prefs:add-model', {
      label: newModel.label.trim() || newModel.modelId.trim(),
      provider: newModel.provider,
      modelId: newModel.modelId.trim(),
      apiKey: newModel.apiKey.trim(),
    })) as PublicPreferences
    setPrefs(data)
    setShowAddModel(false)
    setNewModel({ label: '', provider: 'anthropic', modelId: '', apiKey: '' })
  }

  const removeModel = async (modelId: string) => {
    const data = (await window.electronAPI.invoke('prefs:remove-model', { modelId })) as PublicPreferences
    setPrefs(data)
  }

  const openConnect = () => void window.electronAPI.invoke('auth:open-connect')

  const openBilling = () => void window.electronAPI.invoke('onboarding:open-billing')
  const openDashboard = () => void window.electronAPI.invoke('settings:open-dashboard')

  const startEditProfile = () => {
    if (!profile) return
    setDraftFirstName(profile.firstName ?? '')
    setDraftLastName(profile.lastName ?? '')
    setEditingProfile(true)
  }

  const cancelEditProfile = () => {
    if (profile) {
      setDraftFirstName(profile.firstName ?? '')
      setDraftLastName(profile.lastName ?? '')
    }
    setEditingProfile(false)
  }

  const saveProfile = async () => {
    setProfileSaving(true)
    try {
      const data = (await window.electronAPI.invoke('settings:profile-update', {
        firstName: draftFirstName.trim(),
        lastName: draftLastName.trim(),
      })) as DeviceProfile
      setProfile(data)
      setEditingProfile(false)
    } finally {
      setProfileSaving(false)
    }
  }

  const uploadAvatar = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/webp,image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      if (file.size > 10 * 1024 * 1024) return
      void (async () => {
        try {
          const { base64, mimeType } = await resizeImageForAvatar(file)
          const data = (await window.electronAPI.invoke('settings:profile-avatar-upload', {
            base64,
            mimeType,
          })) as DeviceProfile
          setProfile(data)
        } catch (err) {
          console.error('Avatar upload failed:', err)
        }
      })()
    }
    input.click()
  }

  const removeAvatar = () => {
    void window.electronAPI
      .invoke('settings:profile-avatar-remove')
      .then((data) => setProfile(data as DeviceProfile))
  }
  const openMicSettings = () =>
    void window.electronAPI.invoke('permissions:open-settings', { kind: 'microphone' })
  const openAccessibilitySettings = () =>
    void window.electronAPI.invoke('permissions:open-settings', { kind: 'accessibility' })

  const saveAudioPrefs = async (patch: Partial<AudioPreferences>) => {
    const next = { ...audioPrefs, ...patch }
    setAudioPrefs(next)
    const saved = (await window.electronAPI.invoke('audio:prefs-save', next)) as AudioPreferences
    setAudioPrefs(saved)
  }

  const handleDictationLanguage = (code: string) => {
    void saveAudioPrefs({ dictationLanguage: code })
  }

  const handleDictationOutputLanguage = (code: string) => {
    void saveAudioPrefs({ dictationOutputLanguage: code })
  }

  const handleTranscriptionLanguage = (code: string) => {
    void saveAudioPrefs({ transcriptionLanguage: code })
  }

  const handleOutputLanguage = (code: string) => {
    void saveAudioPrefs({ outputLanguage: code })
  }

  const handleSystemAudioCapture = (mode: 'meeting' | 'display') => {
    void saveAudioPrefs({ systemAudioCapture: mode })
  }

  const handleTranscriptionMode = (mode: 'dual' | 'group') => {
    void saveAudioPrefs({ transcriptionMode: mode })
  }

  const handleMicChange = (deviceId: string) => {
    const device = micDevices.find((d) => d.deviceId === deviceId)
    void saveAudioPrefs({
      preferredMicrophoneId: deviceId,
      preferredMicrophoneLabel: device?.label ?? '',
    })
  }

  const testMicrophone = async () => {
    setTestMicStatus('testing')
    try {
      const deviceId = audioPrefs.preferredMicrophoneId?.trim()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      })
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)

      let maxLevel = 0
      const start = Date.now()
      while (Date.now() - start < 2000) {
        analyser.getByteFrequencyData(data)
        const level = data.reduce((sum, value) => sum + value, 0) / data.length
        maxLevel = Math.max(maxLevel, level)
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      stream.getTracks().forEach((track) => track.stop())
      await ctx.close()
      setTestMicStatus(maxLevel > 5 ? 'success' : 'no-signal')
    } catch {
      setTestMicStatus('error')
    }
  }

  const resetOnboarding = () => {
    void window.electronAPI.invoke('app:reset-onboarding')
  }

  const logoutAccount = () => {
    void window.electronAPI.invoke('app:logout')
    void loadProfile()
  }

  const quitApp = () => {
    void window.electronAPI.invoke('app:quit')
  }

  const eraseAccountData = () => {
    const confirmed = window.confirm(
      'Erase all local account data? This removes device pairing, chat history, preferences, and your local avatar. You will need to sign in again.',
    )
    if (confirmed) {
      void window.electronAPI.invoke('app:erase-account-data')
    }
  }

  const selectedMicLabel =
    audioPrefs.preferredMicrophoneLabel ||
    micDevices.find((d) => d.deviceId === audioPrefs.preferredMicrophoneId)?.label ||
    micDevices[0]?.label ||
    'Default microphone'

  const filteredChatSessions = chatSessions.filter((session) => {
    if (historyFilter === 'active') return !session.archived
    if (historyFilter === 'archived') return Boolean(session.archived)
    return true
  })

  const startRename = (session: ChatSession) => {
    setRenamingId(session.id)
    setRenameDraft(session.title)
  }

  const cancelRename = () => {
    setRenamingId(null)
    setRenameDraft('')
  }

  const saveRename = async (id: string) => {
    const title = renameDraft.trim()
    if (!title) {
      cancelRename()
      return
    }
    const result = (await window.electronAPI.invoke('chat:history-rename-session', {
      id,
      title,
    })) as { sessions?: ChatSession[] }
    if (Array.isArray(result?.sessions)) {
      setChatSessions(result.sessions)
    }
    cancelRename()
  }

  const deleteSession = async (id: string) => {
    const confirmed = window.confirm('Delete this chat permanently?')
    if (!confirmed) return
    const result = (await window.electronAPI.invoke('chat:history-delete-session', {
      id,
    })) as { sessions?: ChatSession[] }
    if (Array.isArray(result?.sessions)) {
      setChatSessions(result.sessions)
    }
  }

  const toggleArchive = async (session: ChatSession) => {
    const result = (await window.electronAPI.invoke('chat:history-archive-session', {
      id: session.id,
      archived: !session.archived,
    })) as { sessions?: ChatSession[] }
    if (Array.isArray(result?.sessions)) {
      setChatSessions(result.sessions)
    }
  }

  const openSessionInOverlay = (id: string) => {
    void window.electronAPI.invoke('chat:history-open-session', { id })
  }

  const startAudioRename = (session: StoredAudioSession) => {
    setAudioRenamingId(session.id)
    setAudioRenameDraft(session.title)
  }

  const cancelAudioRename = () => {
    setAudioRenamingId(null)
    setAudioRenameDraft('')
  }

  const saveAudioRename = async (id: string) => {
    const title = audioRenameDraft.trim()
    if (!title) {
      cancelAudioRename()
      return
    }
    const result = (await window.electronAPI.invoke('audio-sessions:rename', {
      id,
      title,
    })) as { sessions?: StoredAudioSession[] }
    if (Array.isArray(result?.sessions)) {
      setAudioSessions(result.sessions)
    }
    cancelAudioRename()
  }

  const deleteAudioSession = async (id: string) => {
    const confirmed = window.confirm('Delete this audio session permanently?')
    if (!confirmed) return
    const result = (await window.electronAPI.invoke('audio-sessions:delete', {
      id,
    })) as { sessions?: StoredAudioSession[] }
    if (Array.isArray(result?.sessions)) {
      setAudioSessions(result.sessions)
    }
  }

  const openAudioSessionInOverlay = (id: string) => {
    void window.electronAPI.invoke('audio-sessions:open', { id })
  }

  const resetAllKeybinds = () => {
    void window.electronAPI
      .invoke('keybinds:reset-all')
      .then((data) => applyKeybindPrefs(data as { definitions?: KeybindDefinition[]; accelerators?: KeybindPreferences }))
  }

  const resetOneKeybind = (action: KeybindActionId) => {
    void window.electronAPI
      .invoke('keybinds:reset-one', { action })
      .then((data) => applyKeybindPrefs(data as { definitions?: KeybindDefinition[]; accelerators?: KeybindPreferences }))
  }

  const renderPrefsLoading = () => <p className="settings-empty">Loading…</p>

  return (
    <div className="settings-root">
      <div className="settings-drag-region" aria-hidden />
      <aside className="settings-sidebar">
        <div className="settings-brand">
          <span className="settings-brand-dot" />
          Clarifi
        </div>

        <nav className="settings-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`settings-nav-btn ${tab === item.id ? 'active' : ''} ${item.profile ? 'settings-nav-profile' : ''}`}
              onClick={() => setTab(item.id)}
            >
              {item.profile && (
                <span className="settings-profile-avatar" aria-hidden>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                  </svg>
                </span>
              )}
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="settings-shell">
      <main className="settings-main">
        {tab === 'profile' && (
          <>
            <h1 className="settings-section-title">Profile details</h1>

            {!profile ? (
              <p className="settings-empty">Loading profile…</p>
            ) : !profile.paired ? (
              <div className="settings-card">
                <div className="settings-card-title">Not connected</div>
                <p className="settings-card-desc">
                  Sign in on the website and open Clarifi to link this desktop app to your account.
                </p>
                <button type="button" className="settings-btn primary" onClick={openConnect}>
                  Connect account
                </button>
              </div>
            ) : (
              <div className="settings-profile-details">
                <div className="settings-profile-section">
                  <div className="settings-profile-section-label">Profile</div>

                  {!editingProfile ? (
                    <div className="settings-profile-summary-row">
                      <div className="settings-profile-summary-left">
                        <ProfileAvatar profile={profile} />
                        <span className="settings-profile-display-name">
                          {profile.fullName ||
                            `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() ||
                            profile.email}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="settings-link-btn"
                        onClick={startEditProfile}
                      >
                        Update profile
                      </button>
                    </div>
                  ) : (
                    <div className="settings-profile-edit">
                      <div className="settings-profile-upload-row">
                        <ProfileAvatar
                          profile={profile}
                          large
                          draftFirstName={draftFirstName}
                          draftLastName={draftLastName}
                        />
                        <div className="settings-profile-upload-actions">
                          <button type="button" className="settings-btn" onClick={uploadAvatar}>
                            Upload
                          </button>
                          <button
                            type="button"
                            className="settings-link-btn settings-link-btn-danger"
                            onClick={removeAvatar}
                          >
                            Remove
                          </button>
                          <p className="settings-profile-upload-hint">
                            Recommended size 1:1, up to 10MB.
                          </p>
                        </div>
                      </div>

                      <div className="settings-form-grid">
                        <div className="settings-field">
                          <label>First name</label>
                          <input
                            className="settings-input"
                            value={draftFirstName}
                            onChange={(e) => setDraftFirstName(e.target.value)}
                          />
                        </div>
                        <div className="settings-field">
                          <label>Last name</label>
                          <input
                            className="settings-input"
                            value={draftLastName}
                            onChange={(e) => setDraftLastName(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="settings-form-actions settings-form-actions-end">
                        <button
                          type="button"
                          className="settings-link-btn"
                          onClick={cancelEditProfile}
                          disabled={profileSaving}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="settings-btn primary"
                          onClick={() => void saveProfile()}
                          disabled={profileSaving}
                        >
                          {profileSaving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="settings-profile-divider" />

                <div className="settings-profile-section">
                  <div className="settings-profile-section-label">Email addresses</div>
                  {profile.email && (
                    <div className="settings-profile-list-row">
                      <div className="settings-profile-list-main">
                        <span>{profile.email}</span>
                        <span className="settings-pill">Primary</span>
                      </div>
                    </div>
                  )}
                  <button type="button" className="settings-link-btn" onClick={openDashboard}>
                    + Add email address
                  </button>
                </div>

                <div className="settings-profile-divider" />

                <div className="settings-profile-section">
                  <div className="settings-profile-section-label">Connected accounts</div>
                  {(profile.connectedAccounts ?? []).map((account) => (
                    <div key={account.provider} className="settings-profile-list-row">
                      <div className="settings-profile-list-main">
                        {account.provider === 'google' && (
                          <span className="settings-provider-icon" aria-hidden>
                            G
                          </span>
                        )}
                        <span>
                          {account.label}
                          {account.email ? ` · ${account.email}` : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                  <button type="button" className="settings-link-btn" onClick={openConnect}>
                    + Connect account
                  </button>
                </div>

                <div className="settings-profile-divider" />

                <div className="settings-profile-section settings-profile-plan-row">
                  <div>
                    <div className="settings-profile-section-label">Plan</div>
                    <div className="settings-profile-plan-value">
                      {profile.planLabel ?? profile.plan ?? '—'}
                      {typeof profile.sessionsToday === 'number' && (
                        <span className="settings-profile-plan-meta">
                          {' '}
                          · {profile.sessionsToday}
                          {typeof profile.sessionsLimit === 'number'
                            ? ` / ${profile.sessionsLimit}`
                            : profile.sessionsLimit === null
                              ? ' / Unlimited'
                              : ''}{' '}
                          sessions today
                        </span>
                      )}
                    </div>
                  </div>
                  <button type="button" className="settings-btn small" onClick={openBilling}>
                    Manage plan
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'models' && (
          <>
            <h1 className="settings-section-title">Models</h1>
            <p className="settings-section-desc">
              Choose which AI model powers chat and live suggestions. Built-in models use your
              connected Clarifi account keys.
            </p>

            {prefsLoading || !prefs ? (
              renderPrefsLoading()
            ) : (
              <>
                <div className="settings-card" style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                    }}
                  >
                    <div>
                      <div className="settings-card-title">Overlay toolbar</div>
                      <p className="settings-section-desc" style={{ margin: '6px 0 0' }}>
                        Add a model picker to the overlay toolbar for quick switching.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`settings-btn small ${prefs.showModelInToolbar ? 'active-pill' : 'primary'}`}
                      onClick={() => void setShowModelInToolbar(!prefs.showModelInToolbar)}
                    >
                      {prefs.showModelInToolbar ? 'On' : 'Add to toolbar'}
                    </button>
                  </div>
                </div>

                <div className="settings-provider-list">
                  {PROVIDER_ORDER.map((provider) => {
                    const models = modelGroups.get(provider) ?? []
                    if (models.length === 0) return null

                    const isExpanded = expandedProviders.has(provider)
                    const activeInProvider = models.some(
                      (m: ModelConfig) => m.id === prefs.activeModelId,
                    )
                    const anthropicModels =
                      provider === 'anthropic'
                        ? sortAnthropicModels<ModelConfig>(models)
                        : null

                    const renderModelRow = (model: ModelConfig) => (
                      <div key={model.id} className="settings-model-row">
                        <div className="settings-model-info">
                          <span className="settings-model-name">{model.label}</span>
                          <span className="settings-model-id">
                            {model.modelId}
                            {model.builtin ? ' · Built-in' : ''}
                          </span>
                        </div>
                        <div className="settings-model-actions">
                          {prefs.activeModelId === model.id ? (
                            <span className="settings-btn small active-pill">Active</span>
                          ) : (
                            <button
                              type="button"
                              className="settings-btn small primary"
                              onClick={() => void setActiveModel(model.id)}
                            >
                              Use
                            </button>
                          )}
                          {!model.builtin && (
                            <button
                              type="button"
                              className="settings-btn small danger"
                              onClick={() => void removeModel(model.id)}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    )

                    return (
                      <div
                        key={provider}
                        className={`settings-provider-folder ${isExpanded ? 'expanded' : ''}`}
                      >
                        <button
                          type="button"
                          className="settings-provider-header"
                          onClick={() => toggleProvider(provider)}
                          aria-expanded={isExpanded}
                        >
                          <span className="settings-provider-chevron">{isExpanded ? '▼' : '▶'}</span>
                          <span className="settings-provider-name">{PROVIDER_LABELS[provider]}</span>
                          <span className="settings-provider-count">{models.length} models</span>
                          {activeInProvider && (
                            <span className="settings-provider-active-dot" title="Active model" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="settings-provider-body">
                            {anthropicModels ? (
                              anthropicModels.map((model) => (
                                <div key={model.id}>
                                  {model.id === ANTHROPIC_LEGACY_DIVIDER_BEFORE && (
                                    <div className="settings-model-divider" />
                                  )}
                                  {renderModelRow(model)}
                                </div>
                              ))
                            ) : (
                              models.map(renderModelRow)
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {!showAddModel ? (
                  <button
                    type="button"
                    className="settings-btn"
                    style={{ marginTop: 12 }}
                    onClick={() => setShowAddModel(true)}
                  >
                    Add a model
                  </button>
                ) : (
                  <div className="settings-add-form settings-card">
                    <h3>Add custom model</h3>
                    <div className="settings-form-grid">
                      <div className="settings-field">
                        <label>Display name</label>
                        <input
                          className="settings-input"
                          value={newModel.label}
                          onChange={(e) => setNewModel((p) => ({ ...p, label: e.target.value }))}
                          placeholder="My GPT-4"
                        />
                      </div>
                      <div className="settings-field">
                        <label>Provider</label>
                        <select
                          className="settings-input"
                          value={newModel.provider}
                          onChange={(e) =>
                            setNewModel((p) => ({
                              ...p,
                              provider: e.target.value as ModelProvider,
                            }))
                          }
                        >
                          <option value="anthropic">Anthropic</option>
                          <option value="openai">OpenAI</option>
                          <option value="gemini">Google Gemini</option>
                        </select>
                      </div>
                      <div className="settings-field">
                        <label>Model ID</label>
                        <input
                          className="settings-input"
                          value={newModel.modelId}
                          onChange={(e) => setNewModel((p) => ({ ...p, modelId: e.target.value }))}
                          placeholder="gpt-4o-mini"
                        />
                      </div>
                      <div className="settings-field">
                        <label>API key</label>
                        <input
                          className="settings-input"
                          type="password"
                          value={newModel.apiKey}
                          onChange={(e) => setNewModel((p) => ({ ...p, apiKey: e.target.value }))}
                          placeholder="sk-…"
                        />
                      </div>
                    </div>
                    <div className="settings-form-actions">
                      <button type="button" className="settings-btn primary" onClick={() => void addModel()}>
                        Save model
                      </button>
                      <button
                        type="button"
                        className="settings-btn"
                        onClick={() => setShowAddModel(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'modes' && (
          <>
            <h1 className="settings-section-title">Modes</h1>
            <p className="settings-section-desc">
              Modes tailor Clarifi to your use case. The active mode shapes live suggestions and chat
              responses.
            </p>

            {prefsLoading || !prefs ? (
              renderPrefsLoading()
            ) : (
              <>
                {Array.from(modeGroups.entries()).map(([category, modes]) => (
                  <div key={category}>
                    <div className="settings-mode-category">{category}</div>
                    {modes.map((mode: ModeConfig) => (
                      <div key={mode.id} className="settings-card">
                        <div className="settings-card-header">
                          <div>
                            <div className="settings-card-title">{mode.label}</div>
                            <div className="settings-card-meta">
                              {prefs.activeModeId === mode.id ? 'Active mode' : 'Inactive'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {prefs.activeModeId !== mode.id && (
                              <button
                                type="button"
                                className="settings-btn small primary"
                                onClick={() => void activateMode(mode.id)}
                              >
                                Activate
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                <div className="settings-card" style={{ marginTop: 24 }}>
                  <div className="settings-card-title">General context</div>
                  <p className="settings-card-desc">
                    Paste your role, stack, active projects, preferences, and glossary. Used during
                    General mode live assist, suggestions, and chat. If empty, Clarifi infers from
                    the transcript and screen only.
                  </p>
                  <textarea
                    className="settings-textarea"
                    rows={10}
                    placeholder="Role, tech stack, current projects, standing priorities, terms you use…"
                    value={generalKnowledgeDraft}
                    onChange={(e) => setGeneralKnowledgeDraft(e.target.value)}
                  />
                  <div className="settings-profile-upload-row" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="settings-btn"
                      onClick={uploadGeneralKnowledge}
                    >
                      Upload file
                    </button>
                    <button
                      type="button"
                      className="settings-btn small primary"
                      disabled={generalKnowledgeSaving}
                      onClick={() => void saveGeneralKnowledge()}
                    >
                      {generalKnowledgeSaving
                        ? 'Saving…'
                        : generalKnowledgeSaved
                          ? 'Saved'
                          : 'Save context'}
                    </button>
                  </div>
                  <p className="settings-profile-upload-hint">
                    Supports .txt, .md, .csv up to 500 KB. Max 80,000 characters stored.
                  </p>
                </div>

                <div className="settings-card" style={{ marginTop: 24 }}>
                  <div className="settings-card-title">Work knowledge</div>
                  <p className="settings-card-desc">
                    Paste team context, project notes, OKRs, and org details. Used during Meetings
                    mode live calls, suggestions, and chat. If empty, Clarifi infers from the
                    transcript only.
                  </p>
                  <textarea
                    className="settings-textarea"
                    rows={10}
                    placeholder="Paste team structure, project status, stakeholder notes, talking points…"
                    value={workKnowledgeDraft}
                    onChange={(e) => setWorkKnowledgeDraft(e.target.value)}
                  />
                  <div className="settings-profile-upload-row" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="settings-btn"
                      onClick={uploadWorkKnowledge}
                    >
                      Upload file
                    </button>
                    <button
                      type="button"
                      className="settings-btn small primary"
                      disabled={workKnowledgeSaving}
                      onClick={() => void saveWorkKnowledge()}
                    >
                      {workKnowledgeSaving
                        ? 'Saving…'
                        : workKnowledgeSaved
                          ? 'Saved'
                          : 'Save knowledge'}
                    </button>
                  </div>
                  <p className="settings-profile-upload-hint">
                    Supports .txt, .md, .csv up to 500 KB. Max 80,000 characters stored.
                  </p>
                </div>
              </>
            )}
          </>
        )}

        {tab === 'integrations' && (
          <>
            <h1 className="settings-section-title">Integrations</h1>
            <p className="settings-section-desc">
              Services connected to Clarifi for AI, transcription, and account billing.
            </p>

            <div className="settings-card">
              <div className="settings-card-header">
                <div>
                  <div className="settings-card-title">Clarifi account</div>
                  <div className="settings-card-meta">
                    {profile?.paired ? 'Connected' : 'Not connected'}
                  </div>
                </div>
                {!profile?.paired && (
                  <button type="button" className="settings-btn small primary" onClick={openConnect}>
                    Connect
                  </button>
                )}
              </div>
              <p className="settings-card-desc">
                Links this desktop app to your plan, usage limits, and web dashboard.
              </p>
            </div>
          </>
        )}

        {tab === 'keybinds' && (
          <>
            <h1 className="settings-section-title">Keybinds</h1>
            <p className="settings-section-desc">
              Global shortcuts work anywhere on your Mac. Click a shortcut to change it, or reset to defaults.
            </p>

            {recordingKeybindId && (
              <p className="settings-keybind-recording">
                Press a new key combination… <span className="settings-keybind-recording-hint">Esc to cancel</span>
              </p>
            )}
            {keybindError && <p className="settings-keybind-error">{keybindError}</p>}

            <div className="settings-keybind-list">
              {keybindDefinitions.map((bind) => {
                const accelerator = keybindAccelerators?.[bind.id] ?? bind.defaultAccelerator
                const labels = acceleratorToKeyLabels(accelerator)
                const isRecording = recordingKeybindId === bind.id
                return (
                  <div key={bind.id} className="settings-keybind-row">
                    <div className="settings-keybind-copy">
                      <span className="settings-keybind-action">{bind.label}</span>
                      <span className="settings-keybind-desc">{bind.description}</span>
                    </div>
                    <div className="settings-keybind-controls">
                      <button
                        type="button"
                        className={`settings-keybind-keys-btn ${isRecording ? 'recording' : ''}`}
                        onClick={() => {
                          setKeybindError('')
                          setRecordingKeybindId(bind.id)
                        }}
                      >
                        {isRecording ? (
                          <span className="settings-keybind-recording-label">Recording…</span>
                        ) : (
                          labels.map((key, i) => (
                            <span key={`${bind.id}-${key}-${i}`} className="settings-kbd">
                              {key}
                            </span>
                          ))
                        )}
                      </button>
                      <button
                        type="button"
                        className="settings-keybind-reset"
                        onClick={() => resetOneKeybind(bind.id)}
                        title="Reset to default"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <button type="button" className="settings-btn small" onClick={resetAllKeybinds}>
              Reset all to defaults
            </button>
          </>
        )}

        {tab === 'audio' && (
          <>
            <section className="settings-audio-section">
              <h2 className="settings-audio-section-title">Language</h2>
              <p className="settings-audio-section-desc">
                Choose how Clarifi listens and responds during meetings.
              </p>

              <div className="settings-audio-row">
                <div className="settings-audio-row-icon" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 10v4M8 6v12M12 4v16M16 8v8M20 10v4" />
                  </svg>
                </div>
                <div className="settings-audio-row-text">
                  <div className="settings-audio-row-title">Transcription language</div>
                  <div className="settings-audio-row-desc">Select the language you speak in meetings.</div>
                </div>
                <select
                  className="settings-audio-select"
                  value={audioPrefs.transcriptionLanguage}
                  onChange={(e) => handleTranscriptionLanguage(e.target.value)}
                >
                  {TRANSCRIPTION_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="settings-audio-row">
                <div className="settings-audio-row-icon" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 8h6M5 12h10M5 16h6" />
                    <path d="M15 8l4 4-4 4" />
                  </svg>
                </div>
                <div className="settings-audio-row-text">
                  <div className="settings-audio-row-title">Output language</div>
                  <div className="settings-audio-row-desc">Your preferred language for AI and meeting notes.</div>
                </div>
                <select
                  className="settings-audio-select"
                  value={audioPrefs.outputLanguage}
                  onChange={(e) => handleOutputLanguage(e.target.value)}
                >
                  {OUTPUT_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="settings-audio-section">
              <h2 className="settings-audio-section-title">Transcription mode</h2>
              <p className="settings-audio-section-desc">
                Group calls use speaker diarization on system audio. One-on-one uses Me/Them labels.
              </p>

              <div className="settings-audio-row">
                <div className="settings-audio-row-icon" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div className="settings-audio-row-text">
                  <div className="settings-audio-row-title">Call type</div>
                  <div className="settings-audio-row-desc">
                    Group mode labels each participant (Speaker 1, 2, …). Dual mode uses Me and Them.
                  </div>
                </div>
                <select
                  className="settings-audio-select"
                  value={audioPrefs.transcriptionMode}
                  onChange={(e) =>
                    handleTranscriptionMode(e.target.value === 'dual' ? 'dual' : 'group')
                  }
                >
                  <option value="dual">One-on-one (Me / Them) — recommended for sales</option>
                  <option value="group">Group call (Speaker 1, 2, …)</option>
                </select>
              </div>
            </section>

            <section className="settings-audio-section">
              <h2 className="settings-audio-section-title">Remote audio capture</h2>
              <p className="settings-audio-section-desc">
                Controls which system audio is captured during sessions.
              </p>

              <div className="settings-audio-row">
                <div className="settings-audio-row-icon" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                </div>
                <div className="settings-audio-row-text">
                  <div className="settings-audio-row-title">Capture source</div>
                  <div className="settings-audio-row-desc">
                    Meeting apps only (Zoom, Teams, Slack) reduces background noise from other tabs.
                  </div>
                </div>
                <select
                  className="settings-audio-select"
                  value={audioPrefs.systemAudioCapture}
                  onChange={(e) =>
                    handleSystemAudioCapture(e.target.value === 'display' ? 'display' : 'meeting')
                  }
                >
                  <option value="meeting">Meeting apps only (recommended)</option>
                  <option value="display">Entire display audio</option>
                </select>
              </div>

            </section>

            <section className="settings-audio-section">
              <h2 className="settings-audio-section-title">Audio Settings</h2>
              <p className="settings-audio-section-desc">
                Test your audio input before you hop into a call.
              </p>

              <div className="settings-audio-row">
                <div className="settings-audio-row-icon" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="2" width="6" height="11" rx="3" />
                    <path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" />
                  </svg>
                </div>
                <div className="settings-audio-row-text">
                  <div className="settings-audio-row-title">Microphone Source</div>
                  <div className="settings-audio-row-desc">
                    {permissions?.microphone
                      ? `Current: ${selectedMicLabel}`
                      : 'Microphone permission required'}
                  </div>
                </div>
                <div className="settings-audio-row-actions">
                  {micDevices.length > 0 && (
                    <select
                      className="settings-audio-select"
                      value={audioPrefs.preferredMicrophoneId || micDevices[0]?.deviceId || ''}
                      onChange={(e) => handleMicChange(e.target.value)}
                    >
                      {micDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    className="settings-audio-test-btn"
                    onClick={() => void testMicrophone()}
                    disabled={testMicStatus === 'testing' || !permissions?.microphone}
                  >
                    {testMicStatus === 'testing' ? 'Testing…' : 'Test Microphone'}
                  </button>
                </div>
              </div>

              {!permissions?.microphone && (
                <button type="button" className="settings-btn small primary" onClick={openMicSettings}>
                  Open microphone settings
                </button>
              )}

              {testMicStatus === 'success' && (
                <p className="settings-audio-test-result success">Microphone is working.</p>
              )}
              {testMicStatus === 'no-signal' && (
                <p className="settings-audio-test-result warn">
                  No audio detected — try speaking or check your input level.
                </p>
              )}
              {testMicStatus === 'error' && (
                <p className="settings-audio-test-result error">
                  Could not access the microphone. Check permissions and try again.
                </p>
              )}
            </section>

            <section className="settings-audio-section">
              <h2 className="settings-audio-section-title">Dictation</h2>
              <p className="settings-audio-section-desc">
                Hold <strong>Fn (Globe)</strong> on Mac or <strong>Right Ctrl</strong> on Windows to
                dictate into any text field. You can also click the pill at the bottom of your screen — it
                follows whichever app you&apos;re typing in. Dictation uses the microphone selected above.
              </p>

              <div className="settings-audio-row">
                <div className="settings-audio-row-text">
                  <div className="settings-audio-row-title">Dictation language</div>
                  <div className="settings-audio-row-desc">
                    Auto-detect works best for mixed accents. Pick a fixed language if Whisper keeps
                    mishearing you.
                  </div>
                </div>
                <select
                  className="settings-audio-select"
                  value={audioPrefs.dictationLanguage}
                  onChange={(e) => handleDictationLanguage(e.target.value)}
                >
                  {DICTATION_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="settings-audio-row">
                <div className="settings-audio-row-text">
                  <div className="settings-audio-row-title">Dictation output language</div>
                  <div className="settings-audio-row-desc">
                    Choose whether inserted text stays in your spoken language or is rewritten into
                    another language.
                  </div>
                </div>
                <select
                  className="settings-audio-select"
                  value={audioPrefs.dictationOutputLanguage}
                  onChange={(e) => handleDictationOutputLanguage(e.target.value)}
                >
                  {DICTATION_OUTPUT_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="settings-audio-row">
                <div className="settings-audio-row-text">
                  <div className="settings-audio-row-title">Permissions</div>
                  <div className="settings-audio-row-desc">
                    {permissions?.accessibility
                      ? 'Accessibility is enabled — dictation can insert into other apps.'
                      : 'Enable Accessibility so Clarifi can insert dictation into other apps.'}
                    {typeof navigator !== 'undefined' &&
                    navigator.platform.toLowerCase().includes('win')
                      ? ' On Windows, dictation inserts via clipboard paste (Ctrl+V).'
                      : ''}
                  </div>
                </div>
                {!permissions?.accessibility && (
                  <button type="button" className="settings-btn small" onClick={openAccessibilitySettings}>
                    Open Accessibility settings
                  </button>
                )}
              </div>
            </section>
          </>
        )}

        {tab === 'audio_sessions' && (
          <>
            <h1 className="settings-section-title">Audio sessions</h1>
            <p className="settings-section-desc">
              Past meeting recordings with transcripts, recaps, and session-scoped AI chat. Open a session
              in the overlay to review notes or ask questions about that recording only.
            </p>

            {audioSessions.length === 0 ? (
              <p className="settings-empty">No audio sessions yet. Start and stop a session from the overlay.</p>
            ) : (
              <div className="settings-history-list">
                {audioSessions.map((session) => (
                  <div key={session.id} className="settings-history-row">
                    <div className="settings-history-row-main">
                      {audioRenamingId === session.id ? (
                        <input
                          className="settings-history-rename-input"
                          value={audioRenameDraft}
                          onChange={(e) => setAudioRenameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void saveAudioRename(session.id)
                            if (e.key === 'Escape') cancelAudioRename()
                          }}
                          autoFocus
                        />
                      ) : (
                        <div className="settings-history-row-title">{session.title}</div>
                      )}
                      <div className="settings-history-row-meta">
                        {formatHistoryTime(session.createdAt)}
                        {' · '}
                        {session.transcript.length} transcript line
                        {session.transcript.length === 1 ? '' : 's'}
                        {session.chatMessages.length > 0
                          ? ` · ${session.chatMessages.length} chat message${session.chatMessages.length === 1 ? '' : 's'}`
                          : ''}
                      </div>
                    </div>
                    <div className="settings-history-row-actions">
                      {audioRenamingId === session.id ? (
                        <>
                          <button
                            type="button"
                            className="settings-btn small primary"
                            onClick={() => void saveAudioRename(session.id)}
                          >
                            Save
                          </button>
                          <button type="button" className="settings-btn small" onClick={cancelAudioRename}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="settings-btn small"
                            onClick={() => openAudioSessionInOverlay(session.id)}
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            className="settings-btn small"
                            onClick={() => startAudioRename(session)}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="settings-btn small danger"
                            onClick={() => void deleteAudioSession(session.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'history' && (
          <>
            <h1 className="settings-section-title">Chat history</h1>
            <p className="settings-section-desc">
              All your overlay conversations. Open a chat in the overlay, rename it, archive it, or delete it.
            </p>

            <div className="settings-history-filters">
              {(['all', 'active', 'archived'] as HistoryFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`settings-history-filter ${historyFilter === filter ? 'active' : ''}`}
                  onClick={() => setHistoryFilter(filter)}
                >
                  {filter === 'all' ? 'All' : filter === 'active' ? 'Active' : 'Archived'}
                </button>
              ))}
            </div>

            {filteredChatSessions.length === 0 ? (
              <p className="settings-empty">No chats in this view yet.</p>
            ) : (
              <div className="settings-history-list">
                {filteredChatSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`settings-history-row ${session.archived ? 'settings-history-row--archived' : ''}`}
                  >
                    <div className="settings-history-row-main">
                      {renamingId === session.id ? (
                        <input
                          className="settings-history-rename-input"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void saveRename(session.id)
                            if (e.key === 'Escape') cancelRename()
                          }}
                          autoFocus
                        />
                      ) : (
                        <div className="settings-history-row-title">{session.title}</div>
                      )}
                      <div className="settings-history-row-meta">
                        {formatHistoryTime(session.createdAt)}
                        {' · '}
                        {session.messages.length} message{session.messages.length === 1 ? '' : 's'}
                        {session.archived ? ' · Archived' : ''}
                      </div>
                    </div>
                    <div className="settings-history-row-actions">
                      {renamingId === session.id ? (
                        <>
                          <button
                            type="button"
                            className="settings-btn small primary"
                            onClick={() => void saveRename(session.id)}
                          >
                            Save
                          </button>
                          <button type="button" className="settings-btn small" onClick={cancelRename}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="settings-btn small"
                            onClick={() => openSessionInOverlay(session.id)}
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            className="settings-btn small"
                            onClick={() => startRename(session)}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="settings-btn small"
                            onClick={() => void toggleArchive(session)}
                          >
                            {session.archived ? 'Restore' : 'Archive'}
                          </button>
                          <button
                            type="button"
                            className="settings-btn small danger"
                            onClick={() => void deleteSession(session.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'productivity' && <ProactiveSettingsPanel />}
      </main>

      <footer className="settings-footer">
        <span className="settings-footer-label">Account and app</span>
        <div className="settings-footer-actions">
          <button type="button" className="settings-footer-action" onClick={resetOnboarding}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
            Replay product tour
          </button>
          <button type="button" className="settings-footer-action" onClick={logoutAccount}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5M21 12H9" />
            </svg>
            Log out
          </button>
          <button type="button" className="settings-footer-action danger" onClick={eraseAccountData}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
            </svg>
            Erase local data
          </button>
          <button type="button" className="settings-footer-action" onClick={quitApp}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v10" />
              <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
            </svg>
            Quit
          </button>
        </div>
      </footer>
      </div>
    </div>
  )
}
