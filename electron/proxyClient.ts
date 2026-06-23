import fetch from 'node-fetch'
import { getDeviceCredentials } from './deviceAuth'
import { getClarifiApiUrl } from './keys'
import type { ChatRequest, ChatResult, Suggestion } from './llm'

export async function isProxyConfigured(): Promise<boolean> {
  const creds = await getDeviceCredentials()
  const baseUrl = getClarifiApiUrl()
  return Boolean(creds && baseUrl)
}

async function deviceHeaders(): Promise<Record<string, string> | null> {
  const creds = await getDeviceCredentials()
  if (!creds) return null
  return {
    'X-Clarifi-Device-Id': creds.deviceId,
    'X-Clarifi-Device-Secret': creds.deviceSecret,
  }
}

async function proxyFetch(
  path: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const baseUrl = getClarifiApiUrl()
  const headers = await deviceHeaders()
  if (!baseUrl || !headers) {
    return { ok: false, status: 401, data: { error: 'not_authenticated' } }
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })

  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  return { ok: response.ok, status: response.status, data }
}

export async function proxyChat(request: ChatRequest): Promise<ChatResult> {
  const { ok, status, data } = await proxyFetch('/api/llm/chat', request)

  if (status === 401) return { error: 'auth_expired' }
  if (status === 429) return { error: 'rate_limit' }
  if (!ok) {
    const err = (data as { error?: string } | null)?.error
    return { error: err || 'chat_failed' }
  }

  const result = data as ChatResult
  if ('reply' in result && result.reply) return result
  return { error: 'chat_failed' }
}

export async function proxySuggest(
  transcriptLines: string[],
  playbook = '',
): Promise<Suggestion[]> {
  const { ok, status, data } = await proxyFetch('/api/llm/suggest', {
    transcriptLines,
    playbook,
  })

  if (status === 401 || status === 429 || !ok) return []

  const result = data as { suggestions?: Suggestion[] }
  return Array.isArray(result.suggestions) ? result.suggestions : []
}

export async function proxyTranscribe(
  audioBase64: string,
  format: 'wav' | 'webm',
  language = 'en',
  prompt?: string,
  model?: string,
): Promise<string | null> {
  const { ok, status, data } = await proxyFetch('/api/llm/transcribe', {
    audioBase64,
    format,
    language,
    ...(prompt ? { prompt } : {}),
    ...(model ? { model } : {}),
  })

  if (status === 401 || status === 429 || !ok) return null

  const result = data as { text?: string }
  return result.text?.trim() || null
}
