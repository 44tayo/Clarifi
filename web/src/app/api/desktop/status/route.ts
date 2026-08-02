import { getUserIdFromDeviceRequest } from '@/lib/device-auth'
import { getEntitlements } from '@/lib/entitlements'
import { PLAN_LIMITS } from '@/lib/plans'
import { getSubscriptionTrialInfo } from '@/lib/subscription-trial'
import { getUsageStats } from '@/lib/usage'

export async function GET(req: Request) {
  const userId = await getUserIdFromDeviceRequest(req)
  if (!userId) {
    return Response.json({ paired: false }, { status: 401 })
  }

  const [stats, trial] = await Promise.all([
    getUsageStats(userId),
    getSubscriptionTrialInfo(userId),
  ])

  return Response.json({
    paired: true,
    plan: stats.plan,
    planLabel: PLAN_LIMITS[stats.plan].label,
    entitlements: getEntitlements(stats.plan),
    sessionsToday: stats.used,
    sessionsLimit: Number.isFinite(stats.limit) ? stats.limit : null,
    trialEndsAt: trial.trialEndsAt,
    subscriptionStatus: trial.subscriptionStatus,
    trialActive: trial.trialActive,
  })
}
