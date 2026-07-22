import { resolveIntegrationUserId } from '@/lib/integration-auth'
import { requireFeature, planRequiredResponse } from '@/lib/plan-guard'
import { inviteToSharedCommunity } from '@/lib/share-notes'

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

  const payload = body as { communityId?: string; email?: string }
  if (typeof payload.communityId !== 'string' || typeof payload.email !== 'string') {
    return Response.json({ error: 'invalid_payload' }, { status: 400 })
  }

  try {
    await inviteToSharedCommunity(userId, payload.communityId, payload.email)
    return Response.json({ ok: true })
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'plan_required') {
      return planRequiredResponse('pro_plus', 'share_meetings')
    }
    console.error('[desktop/share/invite]', err)
    return Response.json({ error: code ?? 'invite_failed' }, { status: 400 })
  }
}
