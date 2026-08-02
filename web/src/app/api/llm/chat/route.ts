import { authorizeLlmRequest } from '@/lib/llm-route-auth'
import { hasFeature } from '@/lib/entitlements'
import { planRequiredResponse } from '@/lib/plan-guard'
import {
  chatWithMeetingContext,
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
    useScreenContext?: boolean
    screenImage?: { imageBase64: string; mimeType: ChatImageMime }
    images?: unknown
    model?: string
    effort?: ChatEffort
    purpose?: ChatPurpose
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
    // Image attachments in chat share the vision path; gate free users from multi-image uploads
    // only when they also request screen context. Plain chat image attach is allowed for chat.
  }

  const modelId = typeof payload.model === 'string' ? payload.model.trim() : ''
  // Enhance notes picks Sonnet server-side — do not gate on the client's premium model list.
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

  const result = await chatWithMeetingContext({
    message: payload.message,
    transcriptLines,
    useScreenContext: Boolean(payload.useScreenContext),
    screenImage,
    images,
    model: purpose === 'enhance_notes' ? undefined : modelId || undefined,
    effort: normalizeChatEffort(payload.effort),
    purpose,
  })

  if ('error' in result) {
    const status = result.error === 'api_key_missing' ? 503 : 500
    return Response.json({ error: result.error }, { status })
  }

  return Response.json(result)
}
