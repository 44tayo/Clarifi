import { authorizeLlmRequest } from '@/lib/llm-route-auth'
import { hasFeature } from '@/lib/entitlements'
import { planRequiredResponse } from '@/lib/plan-guard'
import {
  chatWithMeetingContext,
  streamChatWithMeetingContext,
  type ChatImageMime,
  type ChatPurpose,
} from '@/lib/llm-server'
import {
  isDefaultChatModel,
  normalizeChatEffort,
  type ChatEffort,
} from '@/lib/chatOptions'

const ALLOWED_MIME = new Set<ChatImageMime>([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
])

function parseImages(value: unknown): Array<{ imageBase64: string; mimeType: ChatImageMime }> {
  if (!Array.isArray(value)) return []
  const images: Array<{ imageBase64: string; mimeType: ChatImageMime }> = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const imageBase64 = (entry as { imageBase64?: unknown }).imageBase64
    const mimeType = (entry as { mimeType?: unknown }).mimeType
    if (typeof imageBase64 !== 'string' || !imageBase64) continue
    if (typeof mimeType !== 'string' || !ALLOWED_MIME.has(mimeType as ChatImageMime)) continue
    images.push({ imageBase64, mimeType: mimeType as ChatImageMime })
    if (images.length >= 6) break
  }
  return images
}

export async function POST(req: Request) {
  const auth = await authorizeLlmRequest(req)
  if (auth instanceof Response) return auth

  const { plan } = auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const payload = body as {
    message?: string
    transcriptLines?: string[]
    history?: Array<{ role?: string; text?: string }>
    scope?: 'all' | 'meeting' | 'folder' | 'selected' | 'person' | 'company'
    folderId?: string | null
    selectedMeetingIds?: string[]
    personEmail?: string | null
    company?: string | null
    useScreenContext?: boolean
    screenImage?: { imageBase64: string; mimeType: ChatImageMime }
    images?: unknown
    model?: string
    effort?: ChatEffort
    purpose?: ChatPurpose
    stream?: boolean
  }

  if (!payload.message || typeof payload.message !== 'string') {
    return Response.json({ error: 'message_required' }, { status: 400 })
  }

  const purpose: ChatPurpose =
    payload.purpose === 'enhance_notes' ? 'enhance_notes' : 'chat'

  const images = parseImages(payload.images)
  const screenImage =
    payload.screenImage?.imageBase64 &&
    typeof payload.screenImage.mimeType === 'string' &&
    ALLOWED_MIME.has(payload.screenImage.mimeType)
      ? payload.screenImage
      : undefined

  if (purpose !== 'enhance_notes' && (payload.useScreenContext || screenImage || images.length > 0)) {
    if (!hasFeature(plan, 'screen_context') && (payload.useScreenContext || screenImage)) {
      return planRequiredResponse('pro', 'screen_context')
    }
  }

  const modelId = typeof payload.model === 'string' ? payload.model.trim() : ''
  if (
    purpose !== 'enhance_notes' &&
    modelId &&
    !isDefaultChatModel(modelId) &&
    !hasFeature(plan, 'premium_models')
  ) {
    return planRequiredResponse('pro', 'premium_models')
  }

  const transcriptLines = Array.isArray(payload.transcriptLines)
    ? payload.transcriptLines.filter((line): line is string => typeof line === 'string')
    : []
  const history = Array.isArray(payload.history)
    ? payload.history
        .filter(
          (entry): entry is { role: 'user' | 'assistant'; text: string } =>
            Boolean(entry) &&
            (entry?.role === 'user' || entry?.role === 'assistant') &&
            typeof entry?.text === 'string',
        )
        .slice(-12)
    : []

  const chatRequest = {
    message: payload.message,
    transcriptLines,
    history,
    useScreenContext: Boolean(payload.useScreenContext),
    screenImage,
    images,
    model: purpose === 'enhance_notes' ? undefined : modelId || undefined,
    effort: normalizeChatEffort(payload.effort),
    purpose,
  }

  const wantStream = payload.stream === true && purpose === 'chat'

  if (wantStream) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (obj: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
        }
        try {
          const result = await streamChatWithMeetingContext(chatRequest, (text) => {
            send({ type: 'delta', text })
          })
          if ('error' in result) {
            send({ type: 'error', error: result.error })
          } else {
            send({
              type: 'done',
              reply: result.reply,
              citations: result.citations ?? [],
            })
          }
        } catch (err) {
          console.error('Chat SSE error:', err)
          send({ type: 'error', error: 'chat_failed' })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  }

  const result = await chatWithMeetingContext(chatRequest)

  if ('error' in result) {
    const status = result.error === 'api_key_missing' ? 503 : 500
    return Response.json({ error: result.error }, { status })
  }

  return Response.json(result)
}
