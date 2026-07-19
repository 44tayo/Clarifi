import { isPaidPlan, normalizePlan, type Plan } from './entitlements'

export type { Plan } from './entitlements'
export { isPaidPlan, normalizePlan }

// Free, Pro, and Pro+ all get unlimited daily AI usage today — the free
// plan's real limit is note history (see getHistoryRetentionDays), not a
// request quota. dailyRequests stays here as a shared abuse-prevention knob.
export const PLAN_LIMITS: Record<Plan, { dailyRequests: number; label: string }> = {
  free: { dailyRequests: Number.POSITIVE_INFINITY, label: 'Free' },
  pro: { dailyRequests: Number.POSITIVE_INFINITY, label: 'Pro' },
  pro_plus: { dailyRequests: Number.POSITIVE_INFINITY, label: 'Pro+' },
}

export function getDailyLimit(plan: Plan): number {
  return PLAN_LIMITS[plan].dailyRequests
}
