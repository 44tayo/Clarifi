import { getUserIdFromDeviceRequest } from '@/lib/device-auth'
import {
  getDesktopUserProfile,
  updateDesktopUserProfile,
} from '@/lib/desktop-profile'
import { getEntitlements } from '@/lib/entitlements'
import { PLAN_LIMITS } from '@/lib/plans'
import { getSubscriptionTrialInfo } from '@/lib/subscription-trial'
import { getUsageStats } from '@/lib/usage'

function profilePayload(
  profile: Awaited<ReturnType<typeof getDesktopUserProfile>>,
  stats: Awaited<ReturnType<typeof getUsageStats>>,
  trial: Awaited<ReturnType<typeof getSubscriptionTrialInfo>>,
) {
  return {
    ...profile,
    plan: stats.plan,
    planLabel: PLAN_LIMITS[stats.plan].label,
    entitlements: getEntitlements(stats.plan),
    sessionsToday: stats.used,
    sessionsLimit: Number.isFinite(stats.limit) ? stats.limit : null,
    trialEndsAt: trial.trialEndsAt,
    subscriptionStatus: trial.subscriptionStatus,
    trialActive: trial.trialActive,
  }
}

export async function GET(req: Request) {
  const userId = await getUserIdFromDeviceRequest(req)
  if (!userId) {
    return Response.json({ paired: false }, { status: 401 })
  }

  const profile = await getDesktopUserProfile(userId)
  if (!profile) {
    return Response.json({ paired: false }, { status: 404 })
  }

  const [stats, trial] = await Promise.all([
    getUsageStats(userId),
    getSubscriptionTrialInfo(userId),
  ])

  return Response.json({
    ...profilePayload(profile, stats, trial),
  })
}

export async function PATCH(req: Request) {
  const userId = await getUserIdFromDeviceRequest(req)
  if (!userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const payload = body as { firstName?: string; lastName?: string }
  if (typeof payload.firstName !== 'string' || typeof payload.lastName !== 'string') {
    return Response.json({ error: 'name_required' }, { status: 400 })
  }

  const result = await updateDesktopUserProfile(userId, {
    firstName: payload.firstName,
    lastName: payload.lastName,
  })

  if (!result.ok) {
    return Response.json({ error: result.error ?? 'update_failed' }, { status: 500 })
  }

  const profile = await getDesktopUserProfile(userId)
  const [stats, trial] = await Promise.all([
    getUsageStats(userId),
    getSubscriptionTrialInfo(userId),
  ])

  return Response.json({
    ...profilePayload(profile, stats, trial),
  })
}
