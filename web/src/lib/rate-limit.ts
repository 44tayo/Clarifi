import { isCreatorUser } from './creator'
import { getDailyLimit, isPaidPlan, type Plan } from './plans'
import { getSupabaseAdmin } from './supabase-admin'

/** Unified quota bucket for all LLM API usage (chat, suggest, transcribe). */
export const LLM_QUOTA_ROUTE = 'llm_session'

const HOURLY_LIMITS: Record<Plan, number> = {
  free: 0,
  pro: 120,
  pro_plus: 200,
}

export function getRateLimitMessage(
  window: 'hour' | 'day' | undefined,
  plan?: Plan,
): string {
  if (!plan || !isPaidPlan(plan)) {
    return 'Start a 7-day free trial to use Clarifi.'
  }
  if (window === 'hour') {
    return 'Hourly usage limit reached. Wait a bit and try again.'
  }
  if (window === 'day') {
    return 'Daily usage limit reached. Try again tomorrow.'
  }
  return 'Too many requests. Please wait and try again.'
}

export async function enforceLlmRateLimit(
  userId: string,
  plan: Plan,
): Promise<{ allowed: boolean; window?: 'hour' | 'day'; retryAfterSeconds?: number }> {
  if (isCreatorUser(userId)) return { allowed: true }

  if (!isPaidPlan(plan)) {
    return { allowed: false }
  }

  const supabase = getSupabaseAdmin()
  const dailyLimit = getDailyLimit(plan)
  const hourlyLimit = HOURLY_LIMITS[plan]

  if (!supabase) {
    console.error('enforceLlmRateLimit: Supabase unavailable')
    return { allowed: false }
  }

  const effectiveDaily = Number.isFinite(dailyLimit) ? dailyLimit : 100_000

  const { data, error } = await supabase.rpc('consume_clerk_api_quota', {
    p_user_id: userId,
    p_route: LLM_QUOTA_ROUTE,
    p_hourly_limit: hourlyLimit,
    p_daily_limit: effectiveDaily,
  })

  if (error) {
    console.error('consume_clerk_api_quota failed:', error.message)
    return { allowed: false }
  }

  const result = data as {
    allowed?: boolean
    window?: 'hour' | 'day'
    retry_after_seconds?: number
  } | null

  if (result?.allowed === false) {
    return {
      allowed: false,
      window: result.window,
      retryAfterSeconds: result.retry_after_seconds,
    }
  }

  return { allowed: true }
}
