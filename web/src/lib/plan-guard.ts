import {
  hasFeature,
  upgradePlanForFeature,
  type Feature,
  type Plan,
} from './entitlements'
import { getUserPlan } from './usage'

export function planRequiredResponse(
  upgrade: 'pro' | 'pro_plus' = 'pro',
  feature?: Feature,
): Response {
  return Response.json(
    {
      error: 'plan_required',
      message: 'Upgrade to Pro to use this feature.',
      upgrade,
      feature,
    },
    { status: 403 },
  )
}

export function isPlanGuardResponse(value: Plan | Response): value is Response {
  return value instanceof Response
}

/**
 * Core AI notetaking (transcribe/chat) is available on every plan, including
 * free — it just resolves which plan the caller is on for rate limiting and
 * entitlement checks. Kept as its own function (rather than inlining
 * getUserPlan) so premium-only routes can still gate on isPaidPlan/hasFeature
 * without re-deriving the plan.
 */
export async function resolvePlan(userId: string): Promise<Plan> {
  return getUserPlan(userId)
}

export async function requireFeature(
  userId: string,
  feature: Feature,
): Promise<Plan | Response> {
  const plan = await getUserPlan(userId)
  if (!hasFeature(plan, feature)) {
    return planRequiredResponse(upgradePlanForFeature(feature), feature)
  }
  return plan
}
