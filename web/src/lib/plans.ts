import { isPaidPlan, normalizePlan, type Plan } from './entitlements'

export type { Plan } from './entitlements'
export { isPaidPlan, normalizePlan }

export const PLAN_LIMITS: Record<Plan, { dailyRequests: number; label: string }> = {
  free: { dailyRequests: 0, label: 'No subscription' },
  pro: { dailyRequests: Number.POSITIVE_INFINITY, label: 'Pro' },
  pro_plus: { dailyRequests: Number.POSITIVE_INFINITY, label: 'Pro+' },
}

export function getDailyLimit(plan: Plan): number {
  return PLAN_LIMITS[plan].dailyRequests
}
