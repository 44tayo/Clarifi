import fetch, { type Response as NodeFetchResponse } from 'node-fetch'

import { getDeviceCredentials } from './deviceAuth'
import { getClarifiApiUrl } from './keys'
import {
  parseClarifiChatSseData,
  type ChatCitation,
} from '../shared/chatStream'

export type ChatImagePayload = {
  imageBase64: string
  mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'
}

export type ChatPurpose = 'chat' | 'enhance_notes'
export type ChatScope = 'all' | 'meeting' | 'folder' | 'selected' | 'person' | 'company'

export type ChatHistoryMessage = {
  role: 'user' | 'assistant'
  text: string
}

export type { ChatCitation }

export type ChatRequest = {
  message: string
  transcriptLines?: string[]
  history?: ChatHistoryMessage[]
  scope?: ChatScope
  folderId?: string | null
  selectedMeetingIds?: string[]
  personEmail?: string | null
  company?: string | null
  useScreenContext?: boolean
  screenImage?: ChatImagePayload
  images?: ChatImagePayload[]
  model?: string
  effort?: 'low' | 'medium' | 'max'
  purpose?: ChatPurpose
}

export type ChatResult =
  | { reply: string; citations?: ChatCitation[] }
  | { error: string }

export type ProxyChatOptions = {
  onDelta?: (text: string) => void
  stream?: boolean
}

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

function chatBody(request: ChatRequest, stream?: boolean): Record<string, unknown> {
  return {
    message: request.message,
    transcriptLines: request.transcriptLines ?? [],
    history: request.history ?? [],
    scope: request.scope ?? 'all',
    ...(request.folderId ? { folderId: request.folderId } : {}),
    ...(request.selectedMeetingIds?.length ? { selectedMeetingIds: request.selectedMeetingIds } : {}),
    ...(request.personEmail ? { personEmail: request.personEmail } : {}),
    ...(request.company ? { company: request.company } : {}),
    useScreenContext: request.useScreenContext ?? false,
    ...(request.screenImage ? { screenImage: request.screenImage } : {}),
    ...(request.images?.length ? { images: request.images } : {}),
    ...(request.model ? { model: request.model } : {}),
    ...(request.effort ? { effort: request.effort } : {}),
    ...(request.purpose ? { purpose: request.purpose } : {}),
    ...(stream ? { stream: true } : {}),
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

  try {
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
  } catch {
    return { ok: false, status: 0, data: { error: 'network_error' } }
  }
}

function mapProxyError(status: number, data: unknown): ChatResult {
  if (status === 0) return { error: 'network_error' }
  if (status === 401) return { error: 'auth_expired' }
  if (status === 403) return { error: 'plan_required' }
  if (status === 429) return { error: 'rate_limit' }
  const err = (data as { error?: string } | null)?.error
  return { error: err || 'chat_failed' }
}

async function consumeChatSse(
  response: NodeFetchResponse,
  onDelta?: (text: string) => void,
): Promise<ChatResult> {
  const body = response.body
  if (!body) return { error: 'chat_failed' }

  let buffer = ''
  let final: ChatResult | null = null

  const handlePayload = (payload: string) => {
    const event = parseClarifiChatSseData(payload)
    if (!event) return
    if (event.type === 'delta') {
      onDelta?.(event.text)
      return
    }
    if (event.type === 'done') {
      final = { reply: event.reply, citations: event.citations ?? [] }
      return
    }
    if (event.type === 'error') {
      final = { error: event.error }
    }
  }

  await new Promise<void>((resolve, reject) => {
    body.on('data', (chunk: Buffer | string) => {
      buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
      const parts = buffer.split('\n')
      buffer = parts.pop() ?? ''
      for (const line of parts) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        handlePayload(trimmed.slice(5).trim())
      }
    })
    body.on('end', () => {
      if (buffer.trim().startsWith('data:')) {
        handlePayload(buffer.trim().slice(5).trim())
      }
      resolve()
    })
    body.on('error', reject)
  })

  if (final) return final
  return { error: 'chat_failed' }
}

async function proxyMeetingChatJson(request: ChatRequest): Promise<ChatResult> {
  const { ok, status, data } = await proxyFetch('/api/llm/chat', chatBody(request, false))
  if (!ok) return mapProxyError(status, data)
  const result = data as { reply?: string; citations?: ChatCitation[]; error?: string }
  if (result.reply) return { reply: result.reply, citations: result.citations }
  return { error: result.error || 'chat_failed' }
}

export async function proxyMeetingChat(
  request: ChatRequest,
  options?: ProxyChatOptions,
): Promise<ChatResult> {
  const wantStream =
    options?.stream !== false &&
    request.purpose !== 'enhance_notes' &&
    Boolean(options?.onDelta)

  if (!wantStream) {
    return proxyMeetingChatJson(request)
  }

  const baseUrl = getClarifiApiUrl()
  const headers = await deviceHeaders()
  if (!baseUrl || !headers) return { error: 'not_authenticated' }

  try {
    const response = await fetch(`${baseUrl}/api/llm/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...headers,
      },
      body: JSON.stringify(chatBody(request, true)),
    })

    const contentType = response.headers.get('content-type') || ''
    if (response.ok && contentType.includes('text/event-stream')) {
      return await consumeChatSse(response, options?.onDelta)
    }

    // Non-stream response or error — parse JSON then fall back if needed
    let data: unknown = null
    try {
      data = await response.json()
    } catch {
      data = null
    }
    if (!response.ok) {
      const mapped = mapProxyError(response.status, data)
      if ('error' in mapped && (mapped.error === 'chat_failed' || mapped.error === 'network_error')) {
        return proxyMeetingChatJson(request)
      }
      return mapped
    }
    const result = data as { reply?: string; citations?: ChatCitation[]; error?: string }
    if (result.reply) {
      options?.onDelta?.(result.reply)
      return { reply: result.reply, citations: result.citations }
    }
  } catch {
    // fall through to non-stream
  }

  return proxyMeetingChatJson(request)
}

/** @deprecated Use proxyMeetingChat */
export async function proxyChat(request: ChatRequest): Promise<ChatResult> {
  return proxyMeetingChat(request)
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

  if (status === 401 || status === 403 || status === 429 || !ok) return null

  const result = data as { text?: string }
  return result.text?.trim() || null
}

export type DiarizedUtterance = {
  speaker: string
  text: string
  startSec?: number
  endSec?: number
  deepgramIndex?: number
}

export async function proxyDiarize(audioBase64: string): Promise<DiarizedUtterance[]> {
  const { ok, status, data } = await proxyFetch('/api/llm/diarize', {
    audioBase64,
    format: 'wav',
    language: 'auto',
  })

  if (status === 401 || status === 403 || status === 429 || !ok) return []

  const result = data as { utterances?: DiarizedUtterance[] }
  return Array.isArray(result.utterances) ? result.utterances : []
}
