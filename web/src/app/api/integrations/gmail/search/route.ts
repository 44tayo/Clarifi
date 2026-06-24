import {
  buildGmailContextText,
  extractGmailSearchQuery,
  searchGmailMessages,
} from '@/lib/gmail'
import { requireIntegrationAccess } from '@/lib/integration-guard'

export async function POST(req: Request) {
  const access = await requireIntegrationAccess(req, 'gmail')
  if (access instanceof Response) return access

  let body: { query?: string; message?: string; maxResults?: number } = {}
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const query =
    body.query?.trim() ||
    (body.message ? extractGmailSearchQuery(body.message) : null) ||
    ''
  if (!query) {
    return Response.json({ error: 'query_required' }, { status: 400 })
  }

  const messages = await searchGmailMessages(
    access.userId,
    query,
    Math.min(Math.max(body.maxResults ?? 5, 1), 8),
  )

  return Response.json({
    query,
    messages,
    context: buildGmailContextText(messages),
    connected: true,
  })
}
