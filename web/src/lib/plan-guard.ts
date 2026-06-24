import {
  hasFeature,
  isPaidPlan,
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
      message: 'Start a 7-day free trial to use Clarifi.',
      upgrade,
      feature,
    },
    { status: 403 },
  )
}

export function isPlanGuardResponse(value: Plan | Response): value is Response {
  return value instanceof Response
}

export async function requirePaidPlan(userId: string): Promise<Plan | Response> {
  const plan = await getUserPlan(userId)
  if (!isPaidPlan(plan)) return planRequiredResponse('pro')
  return plan
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
