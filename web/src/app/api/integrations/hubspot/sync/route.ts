import type { HubSpotRecapPayload } from '@/lib/hubspot'
import { syncRecapToHubSpot } from '@/lib/hubspot'
import { resolveIntegrationUserId } from '@/lib/integration-auth'

export async function POST(req: Request) {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const payload = body as HubSpotRecapPayload
  if (!payload.sessionId || typeof payload.sessionId !== 'string') {
    return Response.json({ error: 'session_id_required' }, { status: 400 })
  }

  const result = await syncRecapToHubSpot(userId, payload)
  if (!result.ok) {
    const status =
      result.error === 'not_connected' || result.error === 'contact_email_required'
        ? 400
        : result.error === 'already_synced'
          ? 409
          : 502
    return Response.json({ error: result.error }, { status })
  }

  return Response.json({
    ok: true,
    noteId: result.noteId,
    taskIds: result.taskIds,
    contactId: result.contactId,
  })
}
