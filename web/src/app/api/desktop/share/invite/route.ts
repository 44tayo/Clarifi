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

  const payload = body as { communityId?: string; email?: string; meetingId?: string }
  if (
    typeof payload.communityId !== 'string' ||
    typeof payload.email !== 'string' ||
    typeof payload.meetingId !== 'string'
  ) {
    return Response.json({ error: 'invalid_payload' }, { status: 400 })
  }

  try {
    const result = await inviteToSharedCommunity(
      userId,
      payload.communityId,
      payload.email,
      payload.meetingId,
    )
    return Response.json({
      ok: true,
      shareUrl: result.shareUrl,
      delivery: result.delivery,
      email: result.email,
      subject: result.subject,
      text: result.text,
    })
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'plan_required') {
      return planRequiredResponse('pro_plus', 'share_meetings')
    }
    if (code === 'share_not_found') {
      return Response.json({ error: 'share_not_found' }, { status: 404 })
    }
    if (code === 'invalid_email' || code === 'meeting_required') {
      return Response.json({ error: code }, { status: 400 })
    }
    console.error('[desktop/share/invite]', err)
    const message =
      typeof (err as { message?: string }).message === 'string'
        ? (err as { message: string }).message
        : undefined
    return Response.json(
      {
        error: code ?? 'invite_failed',
        ...(code === 'email_delivery_failed' && message ? { message } : {}),
      },
      { status: 400 },
    )
  }
}
