import fetch from 'node-fetch'
import { getAnthropicApiKey } from '../keys'
import { CLARIFI_PROACTIVE_SCREEN_ANALYSIS_PROMPT } from './prompts'
import type {
  ProactiveActionPriority,
  ProactiveContextType,
  ProactiveScreenAnalysis,
  ProactiveSuggestedAction,
} from './types'

export const PROACTIVE_ANALYSIS_MODEL = 'claude-sonnet-4-6'
export const PROACTIVE_ANALYSIS_MAX_OUTPUT_TOKENS = 500

const VALID_CONTEXT_TYPES = new Set<ProactiveContextType>([
  'email_reading',
  'email_writing',
  'document_reading',
  'meeting',
  'browsing',
  'slack',
  'other',
])

const VALID_PRIORITIES = new Set<ProactiveActionPriority>(['high', 'medium', 'low'])

function parseJsonPayload<T>(text: string): T | null {
  const trimmed = text.trim()
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed
  try {
    return JSON.parse(candidate) as T
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as T
      } catch {
        return null
      }
    }
    return null
  }
}

function normalizeAction(raw: Partial<ProactiveSuggestedAction>): ProactiveSuggestedAction | null {
  if (!raw.action_id?.trim() || !raw.label?.trim()) return null
  const priority = VALID_PRIORITIES.has(raw.priority as ProactiveActionPriority)
    ? (raw.priority as ProactiveActionPriority)
    : 'medium'
  return {
    action_id: raw.action_id.trim().slice(0, 64),
    label: raw.label.trim().slice(0, 48),
    description: (raw.description ?? '').trim().slice(0, 160),
    priority,
  }
}

function normalizeAnalysis(raw: Partial<ProactiveScreenAnalysis>): ProactiveScreenAnalysis | null {
  if (!raw || typeof raw !== 'object') return null
  const contextType = VALID_CONTEXT_TYPES.has(raw.context_type as ProactiveContextType)
    ? (raw.context_type as ProactiveContextType)
    : 'other'

  const detected_elements = Array.isArray(raw.detected_elements)
    ? raw.detected_elements
        .filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
        .map((e) => e.trim().slice(0, 120))
        .slice(0, 6)
    : []

  const suggested_actions = Array.isArray(raw.suggested_actions)
    ? raw.suggested_actions
        .map((a) => normalizeAction(a as Partial<ProactiveSuggestedAction>))
        .filter((a): a is ProactiveSuggestedAction => a != null)
        .slice(0, 3)
    : []

  return {
    context_type: contextType,
    activity_summary:
      typeof raw.activity_summary === 'string' && raw.activity_summary.trim()
        ? raw.activity_summary.trim().slice(0, 240)
        : 'Screen activity detected',
    detected_elements,
    suggested_actions,
  }
}

export async function analyzeScreenCapture(
  imageBase64: string,
  mimeType: 'image/png' | 'image/jpeg' = 'image/png',
): Promise<ProactiveScreenAnalysis | null> {
  const apiKey = await getAnthropicApiKey()
  if (!apiKey) {
    console.error('[proactive] ANTHROPIC_API_KEY required for screen analysis')
    return null
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: PROACTIVE_ANALYSIS_MODEL,
        max_tokens: PROACTIVE_ANALYSIS_MAX_OUTPUT_TOKENS,
        system: CLARIFI_PROACTIVE_SCREEN_ANALYSIS_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: 'Analyse this screenshot and return the JSON schema.',
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      console.error('[proactive] Anthropic error:', await response.text())
      return null
    }

    const data = (await response.json()) as { content?: Array<{ text?: string }> }
    const text = data.content?.[0]?.text?.trim()
    if (!text) return null

    const parsed = parseJsonPayload<Partial<ProactiveScreenAnalysis>>(text)
    if (!parsed) return null
    return normalizeAnalysis(parsed)
  } catch (err) {
    console.error('[proactive] screen analysis failed:', err)
    return null
  }
}
