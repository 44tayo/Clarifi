import { resolveIntegrationUserId } from '@/lib/integration-auth'
import { requireFeature, planRequiredResponse } from '@/lib/plan-guard'
import { publishSharedMeeting, type SharedMeetingSnapshot } from '@/lib/share-notes'

export async function POST(req: Request) {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const plan = await requireFeature(userId, 'share_meetings')
  if (plan instanceof Response) return plan

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const meeting = (body as { meeting?: SharedMeetingSnapshot }).meeting
  if (!meeting || typeof meeting.id !== 'string' || typeof meeting.title !== 'string') {
    return Response.json({ error: 'meeting_required' }, { status: 400 })
  }

  try {
    const published = await publishSharedMeeting(userId, meeting)
    return Response.json(published)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'plan_required') {
      return planRequiredResponse('pro_plus', 'share_meetings')
    }
    if (code === 'storage_unavailable') {
      return Response.json({ error: 'storage_unavailable' }, { status: 503 })
    }
    console.error('[desktop/share]', err)
    return Response.json({ error: 'share_failed' }, { status: 500 })
  }
}
