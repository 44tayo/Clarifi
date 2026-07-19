import { authorizeLlmRequest } from '@/lib/llm-route-auth'
import { hasFeature } from '@/lib/entitlements'
import { planRequiredResponse } from '@/lib/plan-guard'
import { chatWithMeetingContext } from '@/lib/llm-server'

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
    screenImage?: { imageBase64: string; mimeType: 'image/png' }
  }

  if (!payload.message || typeof payload.message !== 'string') {
    return Response.json({ error: 'message_required' }, { status: 400 })
  }

  if (payload.useScreenContext || payload.screenImage) {
    if (!hasFeature(plan, 'screen_context')) {
      return planRequiredResponse('pro', 'screen_context')
    }
  }

  const transcriptLines = Array.isArray(payload.transcriptLines)
    ? payload.transcriptLines.filter((line): line is string => typeof line === 'string')
    : []

  const result = await chatWithMeetingContext({
    message: payload.message,
    transcriptLines,
    useScreenContext: Boolean(payload.useScreenContext),
    screenImage: payload.screenImage,
  })

  if ('error' in result) {
    const status = result.error === 'api_key_missing' ? 503 : 500
    return Response.json({ error: result.error }, { status })
  }

  return Response.json(result)
}
