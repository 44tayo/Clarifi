import {
  maxTokensForEffort,
  normalizeChatEffort,
  resolveChatApiModel,
  type ChatEffort,
} from './chatOptions'
import {
  createStreamReplyEmitter,
  parseAnthropicSseDataLine,
  parseJsonChatReply,
  type ChatCitation,
} from './chatStream'
import {
  CLARIFI_ENHANCED_NOTES_SYSTEM_PROMPT,
  CLARIFI_ENTERPRISE_SYSTEM_PROMPT,
  CLARIFI_GENERAL_SYSTEM_PROMPT,
  CLARIFI_SUGGESTIONS_SYSTEM_PROMPT,
} from './prompts'
import { resolveAnthropicApiModelId } from './builtin-models'

const CHAT_MODEL = 'claude-haiku-4-5-20251001'
/** Sonnet-class model for post-meeting Enhanced notes. */
export const ENHANCE_NOTES_MODEL_ID = 'claude-fable-5'
export const ENHANCE_NOTES_MAX_TOKENS = 8192

export type ChatPurpose = 'chat' | 'enhance_notes'

export interface Suggestion {
  text: string
  type: 'response' | 'question' | 'action'
}

export type ChatImageMime = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'

export interface ScreenContextImage {
  imageBase64: string
  mimeType: ChatImageMime
}

export interface ChatRequest {
  message: string
  transcriptLines: string[]
  history?: Array<{ role: 'user' | 'assistant'; text: string }>
  useScreenContext: boolean
  screenImage?: ScreenContextImage
  images?: ScreenContextImage[]
  model?: string
  effort?: ChatEffort
  purpose?: ChatPurpose
}

export type { ChatCitation }

export type ChatResult = { reply: string; citations?: ChatCitation[] } | { error: string }

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image'
      source: { type: 'base64'; media_type: ChatImageMime; data: string }
    }

function getAnthropicKey(): string | null {
  return process.env.ANTHROPIC_API_KEY?.trim() || null
}

function collectChatImages(request: ChatRequest): ScreenContextImage[] {
  const images: ScreenContextImage[] = []
  if (request.screenImage?.imageBase64) images.push(request.screenImage)
  if (Array.isArray(request.images)) {
    for (const image of request.images) {
      if (image?.imageBase64 && image.mimeType) images.push(image)
    }
  }
  return images.slice(0, 6)
}

type BuiltChat = {
  apiKey: string
  model: string
  maxTokens: number
  systemPrompt: string
  userContent: AnthropicContentBlock[]
  history: Array<{ role: 'user' | 'assistant'; text: string }>
  isEnhance: boolean
}

function buildChatPayload(
  request: ChatRequest,
  mode: 'json' | 'stream',
): BuiltChat | { error: string } {
  const { message, transcriptLines, useScreenContext } = request
  const purpose = request.purpose === 'enhance_notes' ? 'enhance_notes' : 'chat'
  const images = collectChatImages(request)

  if (useScreenContext && images.length === 0 && purpose !== 'enhance_notes') {
    return { error: 'capture_failed' }
  }

  const apiKey = getAnthropicKey()
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not configured')
    return { error: 'api_key_missing' }
  }

  const transcript =
    transcriptLines.length > 0 ? transcriptLines.join('\n') : '(no transcript yet)'

  const isEnhance = purpose === 'enhance_notes'

  const hasImages = images.length > 0 && !isEnhance
  const screenStyleHint =
    useScreenContext && hasImages
      ? '\n\nReply concisely using screen context reply style. No backticks. No em-dashes. Max 6 visible details bullets. Max 6 tab names. One summary sentence with **bold** key names only. Total response under 1200 characters for simple screen questions.'
      : ''

  const userText = isEnhance
    ? `Meeting transcript:\n${transcript}\n\nEnhance request:\n${message}`
    : hasImages
      ? `Live meeting transcript:\n${transcript}\n\nUser typed question:\n${message}${screenStyleHint}`
      : `Live meeting transcript:\n${transcript}\n\nUser question:\n${message}`

  const history =
    Array.isArray(request.history) && !isEnhance
      ? request.history
          .filter((item) => item && typeof item.text === 'string' && item.text.trim())
          .slice(-12)
      : []

  const citationContract = isEnhance
    ? ''
    : mode === 'stream'
      ? '\n\nAnswer in plain markdown/text (not a JSON object). After the full answer, on a new line write exactly <<<CITATIONS>>> then a JSON array of {"meetingId","title","quote?","entryId?","audioStartMs?"}. Use [] when no transcript/notes evidence supports the answer.'
      : '\n\nReturn strict JSON only with schema: {"reply":"string","citations":[{"meetingId":"string","title":"string","quote":"string(optional)","entryId":"string(optional)","audioStartMs":"number(optional)"}]}. If no citation evidence is available, return citations as [].'

  const systemPrompt =
    (isEnhance
      ? CLARIFI_ENHANCED_NOTES_SYSTEM_PROMPT
      : useScreenContext && hasImages
        ? CLARIFI_ENTERPRISE_SYSTEM_PROMPT
        : CLARIFI_GENERAL_SYSTEM_PROMPT) + citationContract

  const userContent: AnthropicContentBlock[] = [
    ...(hasImages
      ? images.map((image) => ({
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: image.mimeType,
            data: image.imageBase64,
          },
        }))
      : []),
    { type: 'text', text: userText },
  ]

  const model = isEnhance
    ? resolveAnthropicApiModelId(ENHANCE_NOTES_MODEL_ID)
    : resolveChatApiModel(request.model)
  const maxTokens = isEnhance
    ? ENHANCE_NOTES_MAX_TOKENS
    : maxTokensForEffort(normalizeChatEffort(request.effort))

  return {
    apiKey,
    model,
    maxTokens,
    systemPrompt,
    userContent,
    history,
    isEnhance,
  }
}

export async function chatWithMeetingContext(request: ChatRequest): Promise<ChatResult> {
  const built = buildChatPayload(request, 'json')
  if ('error' in built) return built

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': built.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: built.model,
        max_tokens: built.maxTokens,
        system: built.systemPrompt,
        messages: [
          ...built.history.map((entry) => ({
            role: entry.role,
            content: [{ type: 'text', text: entry.text }],
          })),
          { role: 'user', content: built.userContent },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('LLM chat error:', err)
      return { error: 'chat_failed' }
    }

    const data = (await response.json()) as {
      content?: Array<{ text?: string }>
    }
    const reply = data.content?.[0]?.text?.trim()
    if (!reply) return { error: 'empty_reply' }

    if (built.isEnhance) return { reply }

    const parsed = parseJsonChatReply(reply)
    if (parsed) return parsed
    return { reply, citations: [] }
  } catch (err) {
    console.error('Chat error:', err)
    return { error: 'chat_failed' }
  }
}

export async function streamChatWithMeetingContext(
  request: ChatRequest,
  onDelta: (text: string) => void,
): Promise<ChatResult> {
  if (request.purpose === 'enhance_notes') {
    return chatWithMeetingContext(request)
  }

  const built = buildChatPayload(request, 'stream')
  if ('error' in built) return built

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': built.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: built.model,
        max_tokens: built.maxTokens,
        stream: true,
        system: built.systemPrompt,
        messages: [
          ...built.history.map((entry) => ({
            role: entry.role,
            content: [{ type: 'text', text: entry.text }],
          })),
          { role: 'user', content: built.userContent },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('LLM chat stream error:', err)
      return { error: 'chat_failed' }
    }

    if (!response.body) return { error: 'chat_failed' }

    const emitter = createStreamReplyEmitter(onDelta)
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const text = parseAnthropicSseDataLine(line)
        if (text) emitter.push(text)
      }
    }
    if (buffer.trim()) {
      const text = parseAnthropicSseDataLine(buffer)
      if (text) emitter.push(text)
    }

    const finished = emitter.finish()
    if (!finished.reply.trim()) return { error: 'empty_reply' }
    return { reply: finished.reply, citations: finished.citations }
  } catch (err) {
    console.error('Chat stream error:', err)
    return { error: 'chat_failed' }
  }
}

export async function generateSuggestions(
  transcriptLines: string[],
  playbook = '',
): Promise<Suggestion[]> {
  if (transcriptLines.length === 0) return []

  const apiKey = getAnthropicKey()
  if (!apiKey) return []

  const transcript = transcriptLines.join('\n')
  const systemPrompt = `${CLARIFI_SUGGESTIONS_SYSTEM_PROMPT}${playbook ? `\n\nUser context/playbook:\n${playbook}` : ''}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        max_tokens: 300,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Live transcript:\n${transcript}\n\nSuggest what I should say next.`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('LLM suggest error:', err)
      return []
    }

    const data = (await response.json()) as {
      content?: Array<{ text?: string }>
    }
    const text = data.content?.[0]?.text?.trim()
    if (!text) return []

    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean) as Suggestion[]
  } catch (err) {
    console.error('Suggestion error:', err)
    return []
  }
}
