import { getSupabaseAdmin } from './supabase-admin'

/** Best-effort client IP extraction behind Vercel's proxy. */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

/**
 * Fixed-window rate limit backed by Postgres so it holds across serverless
 * invocations. Fails open (allows the request) if the DB is unreachable —
 * availability is preferred over a hard outage for auth-adjacent flows.
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return { allowed: true }

  const { data, error } = await supabase.rpc('consume_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })

  if (error) {
    console.error('consumeRateLimit failed:', error.message)
    return { allowed: true }
  }

  const result = data as { allowed?: boolean; retry_after_seconds?: number } | null
  if (result?.allowed === false) {
    return { allowed: false, retryAfterSeconds: result.retry_after_seconds }
  }
  return { allowed: true }
}

export function rateLimitedResponse(retryAfterSeconds = 60): Response {
  return Response.json(
    { error: 'rate_limited' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  )
}
