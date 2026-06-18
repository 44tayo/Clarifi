import { app, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import {
  buildCustomModePrompt,
  DEFAULT_MODES,
  isBuiltinModeId,
} from './modes/defaultModes'
import {
  BUILTIN_MODELS as SHARED_BUILTIN_MODELS,
  DEFAULT_ACTIVE_MODEL_ID as SHARED_DEFAULT_ACTIVE_MODEL_ID,
  type BuiltinModel,
} from '../shared/builtin-models'
import { deleteKey, getKey, saveKey } from './store'

export type ModelProvider = 'anthropic' | 'openai' | 'gemini' | 'groq' | 'custom'

export type ModelConfig = {
  id: string
  label: string
  provider: ModelProvider
  modelId: string
  builtin?: boolean
}

export type ModeConfig = {
  id: string
  label: string
  category?: string
  systemPrompt: string
  isActive: boolean
  transcriptionMode?: 'dual' | 'group'
  builtin?: boolean
}

export type UserPreferences = {
  activeModelId: string
  models: ModelConfig[]
  activeModeId: string
  modes: ModeConfig[]
  showModelInToolbar: boolean
  /** Optional product/battlecard knowledge for Sales mode live assist and recaps */
  productKnowledge?: string
  /** Optional work context for Meetings mode live assist and chat */
  workKnowledge?: string
  /** Optional personal context for General mode live assist and chat */
  generalKnowledge?: string
}

export type PublicModelConfig = Omit<ModelConfig, never>
export type PublicPreferences = {
  activeModelId: string
  models: PublicModelConfig[]
  activeModeId: string
  modes: ModeConfig[]
  showModelInToolbar: boolean
  productKnowledge: string
  workKnowledge: string
  generalKnowledge: string
}

const PREFS_FILE = 'user-preferences.json'

const DEFAULT_ACTIVE_MODEL_ID = SHARED_DEFAULT_ACTIVE_MODEL_ID

const BUILTIN_MODELS: ModelConfig[] = SHARED_BUILTIN_MODELS.map((model: BuiltinModel) => ({
  ...model,
  builtin: true,
}))

function prefsPath(): string {
  return path.join(app.getPath('userData'), PREFS_FILE)
}

function defaultPreferences(): UserPreferences {
  return {
    activeModelId: DEFAULT_ACTIVE_MODEL_ID,
    models: [...BUILTIN_MODELS],
    activeModeId: 'general',
    modes: DEFAULT_MODES.map((m) => ({ ...m })),
    showModelInToolbar: false,
    productKnowledge: '',
    workKnowledge: '',
    generalKnowledge: '',
  }
}

let cached: UserPreferences | null = null

function mergeModes(stored: ModeConfig[]): ModeConfig[] {
  const byId = new Map(stored.map((m) => [m.id, m]))
  const builtinIds = new Set(DEFAULT_MODES.map((m) => m.id))
  const merged = DEFAULT_MODES.map((defaults) => {
    const existing = byId.get(defaults.id)
    return {
      ...defaults,
      isActive: existing?.isActive ?? defaults.isActive,
    }
  })
  const custom = stored.filter((m) => !builtinIds.has(m.id) && !m.builtin)
  return [...merged, ...custom]
}

function resolveActiveModeId(
  parsed: Partial<UserPreferences>,
  defaults: UserPreferences,
): string {
  const storedModes = Array.isArray(parsed.modes) ? parsed.modes : []
  const hadLegacyMeetingsAsGeneral =
    storedModes.length <= 1 &&
    storedModes.some(
      (m) =>
        m.id === 'general' &&
        !storedModes.some((other) => other.id === 'meetings') &&
        (m.label === 'Meetings' || m.category === 'Meetings'),
    )

  let activeModeId =
    typeof parsed.activeModeId === 'string' ? parsed.activeModeId : defaults.activeModeId

  if (activeModeId === 'sales') {
    activeModeId = 'meetings'
  }

  if (hadLegacyMeetingsAsGeneral && activeModeId === 'general') {
    activeModeId = 'meetings'
  }

  const validIds = new Set(DEFAULT_MODES.map((m) => m.id))
  for (const mode of storedModes) {
    if (!mode.builtin) validIds.add(mode.id)
  }

  if (!validIds.has(activeModeId)) {
    activeModeId = defaults.activeModeId
  }

  return activeModeId
}

function mergeModels(stored: ModelConfig[]): ModelConfig[] {
  const custom = stored.filter((m) => !m.builtin)
  const builtinIds = new Set(BUILTIN_MODELS.map((m) => m.id))
  const keptCustom = custom.filter((m) => !builtinIds.has(m.id))
  return [...BUILTIN_MODELS, ...keptCustom]
}

export function loadUserPreferences(): UserPreferences {
  if (cached) return cached
  try {
    const raw = fs.readFileSync(prefsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<UserPreferences>
    const defaults = defaultPreferences()
    const models = Array.isArray(parsed.models)
      ? mergeModels(parsed.models)
      : defaults.models
    const modelIds = new Set(models.map((m) => m.id))
    let activeModelId =
      typeof parsed.activeModelId === 'string' ? parsed.activeModelId : defaults.activeModelId
    if (!modelIds.has(activeModelId)) {
      activeModelId = modelIds.has(DEFAULT_ACTIVE_MODEL_ID)
        ? DEFAULT_ACTIVE_MODEL_ID
        : (models[0]?.id ?? DEFAULT_ACTIVE_MODEL_ID)
    }
    cached = {
      activeModelId,
      models,
      activeModeId: resolveActiveModeId(parsed, defaults),
      modes: Array.isArray(parsed.modes)
        ? mergeModes(parsed.modes)
        : defaults.modes,
      showModelInToolbar:
        typeof parsed.showModelInToolbar === 'boolean'
          ? parsed.showModelInToolbar
          : defaults.showModelInToolbar,
      productKnowledge:
        typeof parsed.productKnowledge === 'string' ? parsed.productKnowledge : '',
      workKnowledge: typeof parsed.workKnowledge === 'string' ? parsed.workKnowledge : '',
      generalKnowledge:
        typeof parsed.generalKnowledge === 'string' ? parsed.generalKnowledge : '',
    }
    syncActiveModeFlag(cached)
    return cached
  } catch {
    cached = defaultPreferences()
    return cached
  }
}

function syncActiveModeFlag(prefs: UserPreferences): void {
  for (const mode of prefs.modes) {
    mode.isActive = mode.id === prefs.activeModeId
  }
}

export function saveUserPreferences(prefs: UserPreferences): void {
  syncActiveModeFlag(prefs)
  cached = prefs
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(prefsPath(), JSON.stringify(prefs, null, 2))
  } catch (err) {
    console.error('Failed to save user preferences:', err)
  }
  notifyPrefsChanged()
}

export function toPublicPreferences(prefs: UserPreferences): PublicPreferences {
  return {
    activeModelId: prefs.activeModelId,
    models: prefs.models.map(({ id, label, provider, modelId, builtin }) => ({
      id,
      label,
      provider,
      modelId,
      builtin,
    })),
    activeModeId: prefs.activeModeId,
    modes: prefs.modes.map((m) => ({ ...m })),
    showModelInToolbar: prefs.showModelInToolbar,
    productKnowledge: prefs.productKnowledge?.trim() ?? '',
    workKnowledge: prefs.workKnowledge?.trim() ?? '',
    generalKnowledge: prefs.generalKnowledge?.trim() ?? '',
  }
}

export function getWorkKnowledge(prefs = loadUserPreferences()): string {
  return prefs.workKnowledge?.trim() ?? ''
}

export function setWorkKnowledge(knowledge: string): PublicPreferences {
  const prefs = loadUserPreferences()
  const trimmed = knowledge.trim()
  prefs.workKnowledge = trimmed.slice(0, 80_000)
  saveUserPreferences(prefs)
  return toPublicPreferences(prefs)
}

export function getGeneralKnowledge(prefs = loadUserPreferences()): string {
  return prefs.generalKnowledge?.trim() ?? ''
}

export function setGeneralKnowledge(knowledge: string): PublicPreferences {
  const prefs = loadUserPreferences()
  const trimmed = knowledge.trim()
  prefs.generalKnowledge = trimmed.slice(0, 80_000)
  saveUserPreferences(prefs)
  return toPublicPreferences(prefs)
}

export function getProductKnowledge(prefs = loadUserPreferences()): string {
  return prefs.productKnowledge?.trim() ?? ''
}

export function setProductKnowledge(knowledge: string): PublicPreferences {
  const prefs = loadUserPreferences()
  const trimmed = knowledge.trim()
  prefs.productKnowledge = trimmed.slice(0, 80_000)
  saveUserPreferences(prefs)
  return toPublicPreferences(prefs)
}

export function getActiveModel(prefs = loadUserPreferences()): ModelConfig {
  return (
    prefs.models.find((m) => m.id === prefs.activeModelId) ??
    prefs.models[0] ??
    BUILTIN_MODELS.find((m) => m.id === DEFAULT_ACTIVE_MODEL_ID) ??
    BUILTIN_MODELS[0]
  )
}

export function getActiveMode(prefs = loadUserPreferences()): ModeConfig {
  const active = prefs.modes.find(
    (m) => m.id === prefs.activeModeId && !m.transcriptionMode,
  )
  if (active) return active
  return (
    prefs.modes.find((m) => m.id === 'general') ??
    DEFAULT_MODES.find((m) => m.id === 'general')!
  )
}

export async function getModelApiKey(model: ModelConfig): Promise<string | null> {
  if (model.builtin) {
    const { getAnthropicApiKey, getGeminiApiKey, getGroqApiKey, getOpenAiApiKey } =
      await import('./keys')
    if (model.provider === 'anthropic') return getAnthropicApiKey()
    if (model.provider === 'openai') return getOpenAiApiKey()
    if (model.provider === 'gemini') return getGeminiApiKey()
    if (model.provider === 'groq') return getGroqApiKey()
    return getAnthropicApiKey()
  }
  if (model.provider === 'openai' || model.provider === 'gemini') {
    const custom = await getKey(`model:${model.id}`)
    if (custom) return custom
    const { getGeminiApiKey, getOpenAiApiKey } = await import('./keys')
    return model.provider === 'gemini' ? getGeminiApiKey() : getOpenAiApiKey()
  }
  return getKey(`model:${model.id}`)
}

export async function addCustomModel(input: {
  label: string
  provider: ModelProvider
  modelId: string
  apiKey: string
}): Promise<ModelConfig> {
  const prefs = loadUserPreferences()
  const id = `custom-${Date.now()}`
  const model: ModelConfig = {
    id,
    label: input.label.trim() || input.modelId,
    provider: input.provider,
    modelId: input.modelId.trim(),
  }
  await saveKey(`model:${id}`, input.apiKey.trim())
  prefs.models.push(model)
  saveUserPreferences(prefs)
  return model
}

export function setShowModelInToolbar(show: boolean): PublicPreferences {
  const prefs = loadUserPreferences()
  prefs.showModelInToolbar = show
  saveUserPreferences(prefs)
  return toPublicPreferences(prefs)
}

export function setActiveModel(modelId: string): PublicPreferences {
  const prefs = loadUserPreferences()
  if (prefs.models.some((m) => m.id === modelId)) {
    prefs.activeModelId = modelId
    saveUserPreferences(prefs)
  }
  return toPublicPreferences(prefs)
}

export function setActiveMode(modeId: string): PublicPreferences {
  const prefs = loadUserPreferences()
  const resolvedId = modeId === 'sales' ? 'meetings' : modeId
  const mode = prefs.modes.find((m) => m.id === resolvedId)
  if (!mode || mode.transcriptionMode) {
    return toPublicPreferences(prefs)
  }
  prefs.activeModeId = resolvedId
  saveUserPreferences(prefs)
  return toPublicPreferences(prefs)
}

export function createMode(input: {
  label: string
  category?: string
  description?: string
}): PublicPreferences {
  const prefs = loadUserPreferences()
  const label = input.label.trim() || 'Custom Mode'
  const id = `mode-${Date.now()}`
  prefs.modes.push({
    id,
    label,
    category: input.category?.trim() || 'Custom',
    systemPrompt: buildCustomModePrompt(label, input.description),
    isActive: false,
    builtin: false,
  })
  saveUserPreferences(prefs)
  return toPublicPreferences(prefs)
}

export function removeCustomMode(modeId: string): PublicPreferences {
  const prefs = loadUserPreferences()
  if (isBuiltinModeId(modeId)) {
    return toPublicPreferences(prefs)
  }
  const mode = prefs.modes.find((m) => m.id === modeId)
  if (!mode || mode.builtin) {
    return toPublicPreferences(prefs)
  }
  prefs.modes = prefs.modes.filter((m) => m.id !== modeId)
  if (prefs.activeModeId === modeId) {
    prefs.activeModeId = 'general'
  }
  saveUserPreferences(prefs)
  return toPublicPreferences(prefs)
}

export async function removeCustomModel(modelId: string): Promise<PublicPreferences> {
  const prefs = loadUserPreferences()
  const model = prefs.models.find((m) => m.id === modelId)
  if (!model || model.builtin) return toPublicPreferences(prefs)
  prefs.models = prefs.models.filter((m) => m.id !== modelId)
  if (prefs.activeModelId === modelId) {
    prefs.activeModelId = DEFAULT_ACTIVE_MODEL_ID
  }
  await deleteKey(`model:${model.id}`)
  saveUserPreferences(prefs)
  return toPublicPreferences(prefs)
}

function notifyPrefsChanged(): void {
  const payload = toPublicPreferences(loadUserPreferences())
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('prefs:changed', payload)
    }
  }
}
