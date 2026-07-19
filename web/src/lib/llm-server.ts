import {
  CLARIFI_ENTERPRISE_SYSTEM_PROMPT,
  CLARIFI_GENERAL_SYSTEM_PROMPT,
  CLARIFI_SUGGESTIONS_SYSTEM_PROMPT,
} from './prompts'

const CHAT_MODEL = 'claude-haiku-4-5-20251001'

export interface Suggestion {
  text: string
  type: 'response' | 'question' | 'action'
}

export interface ScreenContextImage {
  imageBase64: string
  mimeType: 'image/png'
}

export interface ChatRequest {
  message: string
  transcriptLines: string[]
  useScreenContext: boolean
  screenImage?: ScreenContextImage
}

export type ChatResult = { reply: string } | { error: string }

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image'
      source: { type: 'base64'; media_type: 'image/png'; data: string }
    }

function getAnthropicKey(): string | null {
  return process.env.ANTHROPIC_API_KEY?.trim() || null
}

export async function chatWithMeetingContext(request: ChatRequest): Promise<ChatResult> {
  const { message, transcriptLines, useScreenContext, screenImage } = request

  if (useScreenContext && !screenImage) {
    return { error: 'capture_failed' }
  }

  const apiKey = getAnthropicKey()
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not configured')
    return { error: 'api_key_missing' }
  }

  const transcript =
    transcriptLines.length > 0 ? transcriptLines.join('\n') : '(no transcript yet)'

  const screenStyleHint = screenImage
    ? '\n\nReply concisely using screen context reply style. No backticks. No em-dashes. Max 6 visible details bullets. Max 6 tab names. One summary sentence with **bold** key names only. Total response under 1200 characters for simple screen questions.'
    : ''

  const userText = screenImage
    ? `Live meeting transcript:\n${transcript}\n\nUser typed question:\n${message}${screenStyleHint}`
    : `Live meeting transcript:\n${transcript}\n\nUser question:\n${message}`

  const systemPrompt = screenImage
    ? CLARIFI_ENTERPRISE_SYSTEM_PROMPT
    : CLARIFI_GENERAL_SYSTEM_PROMPT

  const userContent: AnthropicContentBlock[] = screenImage
    ? [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: screenImage.mimeType,
            data: screenImage.imageBase64,
          },
        },
        { type: 'text', text: userText },
      ]
    : [{ type: 'text', text: userText }]

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
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
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

    return { reply }
  } catch (err) {
    console.error('Chat error:', err)
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
