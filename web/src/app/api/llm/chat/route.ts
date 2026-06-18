import {
  buildGmailContextText,
  extractGmailSearchQuery,
  messageRequestsGmailContext,
  searchGmailMessages,
} from '@/lib/gmail'
import {
  getUserIdFromRequest,
  planLimitResponse,
  unauthorizedResponse,
} from '@/lib/request-auth'
import { chatWithMeetingContext } from '@/lib/llm-server'
import { enforceLlmRateLimit, getRateLimitMessage } from '@/lib/rate-limit'
import { getUserPlan } from '@/lib/usage'

export async function POST(req: Request) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return unauthorizedResponse()

  const plan = await getUserPlan(userId)
  const rate = await enforceLlmRateLimit(userId, plan, 'llm_chat')
  if (!rate.allowed) {
    return planLimitResponse(
      getRateLimitMessage(rate.window),
      rate.window,
      rate.retryAfterSeconds,
    )
  }

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
    screenImage?: { imageBase64: string; mimeType: 'image/png' }
    emailContext?: string
  }

  if (!payload.message || typeof payload.message !== 'string') {
    return Response.json({ error: 'message_required' }, { status: 400 })
  }

  const transcriptLines = Array.isArray(payload.transcriptLines)
    ? payload.transcriptLines.filter((line): line is string => typeof line === 'string')
    : []

  let emailContext =
    typeof payload.emailContext === 'string' ? payload.emailContext.trim() : ''
  if (!emailContext && messageRequestsGmailContext(payload.message)) {
    const query = extractGmailSearchQuery(payload.message)
    if (query) {
      const messages = await searchGmailMessages(userId, query, 5)
      emailContext = buildGmailContextText(messages)
    }
  }

  const result = await chatWithMeetingContext({
    message: payload.message,
    transcriptLines,
    useScreenContext: Boolean(payload.useScreenContext),
    screenImage: payload.screenImage,
    emailContext: emailContext || undefined,
  })

  if ('error' in result) {
    const status = result.error === 'api_key_missing' ? 503 : 500
    return Response.json({ error: result.error }, { status })
  }

  return Response.json(result)
}
