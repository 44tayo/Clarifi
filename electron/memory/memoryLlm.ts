import fetch from 'node-fetch'
import { getAnthropicApiKey } from '../keys'
import { MEMORY_ANALYSIS_MODEL } from './constants'

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

export async function completeMemoryAnalysis(
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
): Promise<string | null> {
  const apiKey = await getAnthropicApiKey()
  if (!apiKey) {
    console.error('[memory] ANTHROPIC_API_KEY required for memory analysis')
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
        model: MEMORY_ANALYSIS_MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!response.ok) {
      console.error('[memory] Anthropic error:', await response.text())
      return null
    }

    const data = (await response.json()) as { content?: Array<{ text?: string }> }
    return data.content?.[0]?.text?.trim() ?? null
  } catch (err) {
    console.error('[memory] LLM request failed:', err)
    return null
  }
}

export function parseMemoryJson<T>(text: string): T | null {
  return parseJsonPayload<T>(text)
}
