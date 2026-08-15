import { resolveIntegrationUserId } from '@/lib/integration-auth'
import { planRequiredResponse } from '@/lib/plan-guard'
import { acceptSharedInvite } from '@/lib/shared-with-me'

export async function POST(req: Request) {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const token = (body as { token?: string }).token
  if (!token || typeof token !== 'string') {
    return Response.json({ error: 'token_required' }, { status: 400 })
  }

  try {
    const result = await acceptSharedInvite(userId, token)
    return Response.json(result)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'plan_required') {
      return planRequiredResponse('pro_plus', 'communities')
    }
    if (
      code === 'invalid_token' ||
      code === 'invite_not_pending' ||
      code === 'invite_expired' ||
      code === 'email_mismatch'
    ) {
      return Response.json({ error: code }, { status: 400 })
    }
    console.error('[desktop/shared-with-me/accept]', err)
    return Response.json({ error: 'accept_failed' }, { status: 500 })
  }
}
