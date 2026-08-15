import { authorizeLlmRequest } from '@/lib/llm-route-auth'
import { generateSuggestions } from '@/lib/llm-server'

export async function POST(req: Request) {
  const auth = await authorizeLlmRequest(req)
  if (auth instanceof Response) return auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const payload = body as {
    transcriptLines?: string[]
    playbook?: string
  }

  const transcriptLines = Array.isArray(payload.transcriptLines)
    ? payload.transcriptLines.filter((line): line is string => typeof line === 'string')
    : []

  const suggestions = await generateSuggestions(transcriptLines, payload.playbook ?? '')
  return Response.json({ suggestions })
}
