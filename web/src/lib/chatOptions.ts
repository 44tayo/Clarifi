import {
  BUILTIN_MODELS,
  DEFAULT_ACTIVE_MODEL_ID,
  resolveAnthropicApiModelId,
  type BuiltinModel,
} from './builtin-models'

export type ChatEffort = 'low' | 'medium' | 'max'

export const CHAT_EFFORTS: Array<{ id: ChatEffort; label: string }> = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'max', label: 'Max Effort' },
]

/** Anthropic-backed chat models only — desktop chat routes through Anthropic today. */
export function chatSelectableModels(): BuiltinModel[] {
  return BUILTIN_MODELS.filter((model) => model.provider === 'anthropic')
}

export function isDefaultChatModel(modelId: string): boolean {
  return modelId === DEFAULT_ACTIVE_MODEL_ID || modelId === 'claude-haiku-4-5-20251001'
}

export function resolveChatApiModel(modelId: string | undefined | null): string {
  const selected =
    typeof modelId === 'string' && modelId.trim()
      ? chatSelectableModels().find((model) => model.id === modelId.trim())
      : undefined
  const raw = selected?.modelId ?? 'claude-haiku-4-5-20251001'
  return resolveAnthropicApiModelId(raw)
}

export function maxTokensForEffort(effort: ChatEffort | string | undefined | null): number {
  switch (effort) {
    case 'low':
      return 1024
    case 'max':
      return 4096
    case 'medium':
    default:
      return 2048
  }
}

export function normalizeChatEffort(value: unknown): ChatEffort {
  if (value === 'low' || value === 'max') return value
  return 'medium'
}
