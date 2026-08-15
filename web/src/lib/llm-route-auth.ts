import { resolvePlan } from '@/lib/plan-guard'
import { enforceLlmRateLimit, getRateLimitMessage } from '@/lib/rate-limit'
import { planLimitResponse, unauthorizedResponse } from '@/lib/request-auth'
import { getUserIdFromRequest } from '@/lib/request-auth'
import type { Plan } from '@/lib/plans'

// Core AI notetaking (transcribe/chat/suggest) is available on every plan,
// including free — Granola-style. This only checks authentication and a
// shared abuse-prevention rate limit, not payment status.
export async function authorizeLlmRequest(
  req: Request,
): Promise<{ userId: string; plan: Plan } | Response> {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return unauthorizedResponse()

  const plan = await resolvePlan(userId)

  const rate = await enforceLlmRateLimit(userId, plan)
  if (!rate.allowed) {
    return planLimitResponse(
      getRateLimitMessage(rate.window),
      rate.window,
      rate.retryAfterSeconds,
    )
  }

  return { userId, plan }
}
