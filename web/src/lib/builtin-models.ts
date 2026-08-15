/** Single source for built-in AI models — keep in sync with the desktop app Models settings. */

export type ModelProvider = 'anthropic' | 'openai' | 'gemini' | 'groq' | 'custom'

export type BuiltinModel = {
  id: string
  label: string
  provider: ModelProvider
  modelId: string
}

export const DEFAULT_ACTIVE_MODEL_ID = 'claude-haiku-4-5'

/** Fast model for live sales assist (always Haiku regardless of toolbar selection). */
export const SALES_ASSIST_ANTHROPIC_MODEL_ID = 'claude-haiku-4-5-20251001'

/**
 * Map UI / marketing model ids to Anthropic API model strings.
 * Fable and other preview-tier labels may not exist on the public API yet.
 */
export const ANTHROPIC_API_MODEL_ALIASES: Record<string, string> = {
  'claude-fable-5': 'claude-sonnet-4-6',
}

export function resolveAnthropicApiModelId(modelId: string): string {
  return ANTHROPIC_API_MODEL_ALIASES[modelId] ?? modelId
}

export const ANTHROPIC_MODEL_ORDER = [
  'claude-fable-5',
  'claude-opus-4-8',
  'claude-haiku-4-5',
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-opus-3',
] as const

export const ANTHROPIC_LEGACY_DIVIDER_BEFORE = 'claude-opus-4-7'

export const PROVIDER_ORDER: ModelProvider[] = ['anthropic', 'openai', 'gemini']

export const PROVIDER_LABELS: Record<ModelProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  groq: 'Groq',
  custom: 'Custom',
}

export const BUILTIN_MODELS: BuiltinModel[] = [
  {
    id: 'claude-fable-5',
    label: 'Claude Fable 5',
    provider: 'anthropic',
    modelId: 'claude-fable-5',
  },
  {
    id: 'claude-opus-4-8',
    label: 'Claude Opus 4.8',
    provider: 'anthropic',
    modelId: 'claude-opus-4-8',
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    provider: 'anthropic',
    modelId: 'claude-haiku-4-5-20251001',
  },
  {
    id: 'claude-opus-4-7',
    label: 'Claude Opus 4.7',
    provider: 'anthropic',
    modelId: 'claude-opus-4-7',
  },
  {
    id: 'claude-opus-4-6',
    label: 'Claude Opus 4.6',
    provider: 'anthropic',
    modelId: 'claude-opus-4-6',
  },
  {
    id: 'claude-opus-3',
    label: 'Claude Opus 3',
    provider: 'anthropic',
    modelId: 'claude-3-opus-20240229',
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'openai',
    modelId: 'gpt-4o',
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    provider: 'openai',
    modelId: 'gpt-4o-mini',
  },
  {
    id: 'gpt-4-1',
    label: 'GPT-4.1',
    provider: 'openai',
    modelId: 'gpt-4.1',
  },
  {
    id: 'gpt-4-1-mini',
    label: 'GPT-4.1 Mini',
    provider: 'openai',
    modelId: 'gpt-4.1-mini',
  },
  {
    id: 'gpt-4-1-nano',
    label: 'GPT-4.1 Nano',
    provider: 'openai',
    modelId: 'gpt-4.1-nano',
  },
  {
    id: 'o3-mini',
    label: 'o3-mini',
    provider: 'openai',
    modelId: 'o3-mini',
  },
  {
    id: 'o4-mini',
    label: 'o4-mini',
    provider: 'openai',
    modelId: 'o4-mini',
  },
  {
    id: 'gemini-2-5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'gemini',
    modelId: 'gemini-2.5-flash',
  },
  {
    id: 'gemini-2-5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'gemini',
    modelId: 'gemini-2.5-pro',
  },
  {
    id: 'gemini-2-0-flash',
    label: 'Gemini 2.0 Flash',
    provider: 'gemini',
    modelId: 'gemini-2.0-flash',
  },
  {
    id: 'gemini-2-0-flash-lite',
    label: 'Gemini 2.0 Flash Lite',
    provider: 'gemini',
    modelId: 'gemini-2.0-flash-lite',
  },
  {
    id: 'gemini-1-5-flash',
    label: 'Gemini 1.5 Flash',
    provider: 'gemini',
    modelId: 'gemini-1.5-flash',
  },
  {
    id: 'gemini-1-5-pro',
    label: 'Gemini 1.5 Pro',
    provider: 'gemini',
    modelId: 'gemini-1.5-pro',
  },
]

const ANTHROPIC_ORDER = new Map(ANTHROPIC_MODEL_ORDER.map((id, index) => [id, index]))

export function sortAnthropicModels<T extends BuiltinModel>(models: T[]): T[] {
  return [...models].sort((a, b) => {
    const ai = ANTHROPIC_ORDER.get(a.id as (typeof ANTHROPIC_MODEL_ORDER)[number]) ?? 999
    const bi = ANTHROPIC_ORDER.get(b.id as (typeof ANTHROPIC_MODEL_ORDER)[number]) ?? 999
    if (ai !== bi) return ai - bi
    return a.label.localeCompare(b.label)
  })
}

export function groupBuiltinModelsByProvider(
  models: BuiltinModel[] = BUILTIN_MODELS,
): Map<ModelProvider, BuiltinModel[]> {
  const map = new Map<ModelProvider, BuiltinModel[]>()
  for (const provider of PROVIDER_ORDER) {
    map.set(provider, [])
  }
  for (const model of models) {
    if (!PROVIDER_ORDER.includes(model.provider)) continue
    const list = map.get(model.provider) ?? []
    list.push(model)
    map.set(model.provider, list)
  }
  for (const provider of PROVIDER_ORDER) {
    const list = map.get(provider) ?? []
    if (provider === 'anthropic') {
      map.set(provider, sortAnthropicModels(list))
    }
  }
  return map
}
