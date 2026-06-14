import { isCreatorUser } from './creator'
import { getDailyLimit, normalizePlan, type Plan } from './plans'
import { getSupabaseAdmin } from './supabase-admin'

type UsageBucket = {
  date: string
  count: number
}

const memoryUsage = new Map<string, UsageBucket>()

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

async function readCount(userId: string, date: string): Promise<number> {
  const supabase = getSupabaseAdmin()
  if (supabase) {
    const start = `${date}T00:00:00.000Z`
    const end = `${date}T23:59:59.999Z`
    const { count, error } = await supabase
      .from('api_rate_limit_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .like('route', 'llm_%')
      .gte('created_at', start)
      .lte('created_at', end)

    if (error) {
      console.error('readCount failed:', error.message)
      return 0
    }

    return count ?? 0
  }

  const bucket = memoryUsage.get(`${userId}:${date}`)
  return bucket?.count ?? 0
}

export async function getUserPlan(userId: string): Promise<Plan> {
  if (isCreatorUser(userId)) return 'pro_plus'

  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { data } = await supabase
      .from('profiles')
      .select('plan')
      .eq('user_id', userId)
      .maybeSingle()

    if (data?.plan) return normalizePlan(data.plan)
  }

  return 'free'
}

export async function getUserBillingProfile(userId: string): Promise<{
  plan: Plan
  stripeCustomerId: string | null
}> {
  const supabase = getSupabaseAdmin()
  let plan: Plan = 'free'
  let stripeCustomerId: string | null = null

  if (supabase) {
    const { data } = await supabase
      .from('profiles')
      .select('plan, stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle()

    plan = normalizePlan(data?.plan)
    stripeCustomerId = data?.stripe_customer_id ?? null
  }

  if (isCreatorUser(userId)) {
    plan = 'pro_plus'
  }

  return { plan, stripeCustomerId }
}

export async function getUsageStats(
  userId: string,
  plan?: Plan,
): Promise<{ used: number; limit: number; plan: Plan }> {
  const resolvedPlan = plan ?? (await getUserPlan(userId))
  const used = await readCount(userId, todayUtc())
  const limit = getDailyLimit(resolvedPlan)
  return { used, limit: Number.isFinite(limit) ? limit : used, plan: resolvedPlan }
}

export async function setUserPlan(
  userId: string,
  plan: Plan,
  stripe?: { customerId?: string | null; subscriptionId?: string | null },
): Promise<void> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return

  await supabase.from('profiles').upsert(
    {
      user_id: userId,
      plan,
      stripe_customer_id: stripe?.customerId ?? null,
      stripe_subscription_id: stripe?.subscriptionId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
}
