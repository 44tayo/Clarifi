import fetch from 'node-fetch'
import { BrowserWindow } from 'electron'
import { groqKeepAliveAgent } from '../groqHttp'
import { getAnthropicApiKey, getGroqApiKey } from '../keys'
import {
  DICTATION_POLISH_GROQ_MODEL,
  DICTATION_POLISH_MAX_OUTPUT_TOKENS,
  DICTATION_POLISH_MODEL,
  PROACTIVE_FEATURE_MAX_OUTPUT_TOKENS,
  PROACTIVE_FEATURE_MODEL,
} from './featureTypes'

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

function emitStream(requestId: string, type: 'chunk' | 'done' | 'error', payload: string): void {
  const channel =
    type === 'chunk'
      ? 'proactive:stream-chunk'
      : type === 'done'
        ? 'proactive:stream-done'
        : 'proactive:stream-error'
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, { requestId, text: payload })
    }
  }
}

export async function streamProactiveCompletion(
  requestId: string,
  systemPrompt: string,
  userContent: string,
  maxTokens = PROACTIVE_FEATURE_MAX_OUTPUT_TOKENS,
): Promise<string | null> {
  const apiKey = await getAnthropicApiKey()
  if (!apiKey) {
    emitStream(requestId, 'error', 'API key missing')
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
        model: PROACTIVE_FEATURE_MODEL,
        max_tokens: maxTokens,
        stream: true,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!response.ok || !response.body) {
      emitStream(requestId, 'error', await response.text())
      return null
    }

    let fullText = ''
    const decoder = new TextDecoder()
    let buffer = ''

    for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data) as {
            type?: string
            delta?: { type?: string; text?: string }
          }
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullText += parsed.delta.text
            emitStream(requestId, 'chunk', parsed.delta.text)
          }
        } catch {
          // ignore partial SSE lines
        }
      }
    }

    emitStream(requestId, 'done', fullText)
    return fullText.trim()
  } catch (err) {
    emitStream(requestId, 'error', String(err))
    return null
  }
}

export async function completeProactiveJson<T>(
  systemPrompt: string,
  userContent: string,
  maxTokens = PROACTIVE_FEATURE_MAX_OUTPUT_TOKENS,
): Promise<T | null> {
  const apiKey = await getAnthropicApiKey()
  if (!apiKey) return null

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: PROACTIVE_FEATURE_MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!response.ok) return null
    const data = (await response.json()) as { content?: Array<{ text?: string }> }
    const text = data.content?.[0]?.text?.trim()
    if (!text) return null
    return parseJsonPayload<T>(text)
  } catch {
    return null
  }
}

export async function completeProactiveText(
  systemPrompt: string,
  userContent: string,
  maxTokens = PROACTIVE_FEATURE_MAX_OUTPUT_TOKENS,
): Promise<string | null> {
  const requestId = 'sync'
  const apiKey = await getAnthropicApiKey()
  if (!apiKey) return null

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: PROACTIVE_FEATURE_MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!response.ok) return null
    const data = (await response.json()) as { content?: Array<{ text?: string }> }
    return data.content?.[0]?.text?.trim() ?? null
  } catch {
    return null
  }
}

/**
 * Fastest dictation polish: Groq llama on the same connection as transcription
 * (no extra provider hop, no proxy round-trip). Falls back to Anthropic Haiku
 * when no Groq key is available locally.
 */
export async function completeDictationTextFast(
  systemPrompt: string,
  userContent: string,
  maxTokens = DICTATION_POLISH_MAX_OUTPUT_TOKENS,
): Promise<string | null> {
  const groqKey = await getGroqApiKey()
  if (groqKey) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: DICTATION_POLISH_GROQ_MODEL,
          max_tokens: maxTokens,
          temperature: 0,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
        }),
        agent: groqKeepAliveAgent,
      })

      if (response.ok) {
        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>
        }
        const text = data.choices?.[0]?.message?.content?.trim()
        if (text) return text
      }
    } catch {
      // Fall through to the Anthropic path below.
    }
  }

  return completeDictationText(systemPrompt, userContent, maxTokens)
}

/** Low-latency dictation polish — Haiku, temperature 0 for transcript fidelity. */
export async function completeDictationText(
  systemPrompt: string,
  userContent: string,
  maxTokens = DICTATION_POLISH_MAX_OUTPUT_TOKENS,
): Promise<string | null> {
  const apiKey = await getAnthropicApiKey()
  if (!apiKey) return null

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: DICTATION_POLISH_MODEL,
        max_tokens: maxTokens,
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!response.ok) return null
    const data = (await response.json()) as { content?: Array<{ text?: string }> }
    return data.content?.[0]?.text?.trim() ?? null
  } catch {
    return null
  }
}
