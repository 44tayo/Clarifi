import { isPlanGuardResponse, requirePaidPlan } from '@/lib/plan-guard'
import { enforceLlmRateLimit, getRateLimitMessage } from '@/lib/rate-limit'
import { planLimitResponse, unauthorizedResponse } from '@/lib/request-auth'
import { getUserIdFromRequest } from '@/lib/request-auth'
import { getUserPlan } from '@/lib/usage'
import type { Plan } from '@/lib/plans'

export async function authorizeLlmRequest(
  req: Request,
): Promise<{ userId: string; plan: Plan } | Response> {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return unauthorizedResponse()

  const planOrBlock = await requirePaidPlan(userId)
  if (isPlanGuardResponse(planOrBlock)) return planOrBlock

  const rate = await enforceLlmRateLimit(userId, planOrBlock)
  if (!rate.allowed) {
    const plan = await getUserPlan(userId)
    return planLimitResponse(
      getRateLimitMessage(rate.window, plan),
      rate.window,
      rate.retryAfterSeconds,
    )
  }

  return { userId, plan: planOrBlock }
}
