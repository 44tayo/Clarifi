import { getServerUserId } from '@/lib/auth-server'
import { createDesktopAuthToken } from '@/lib/device-auth'
import { consumeRateLimit, rateLimitedResponse } from '@/lib/ip-rate-limit'

const AUTHORIZE_LIMIT = 20
const AUTHORIZE_WINDOW_SECONDS = 60 * 60

export async function POST() {
  const userId = await getServerUserId()
  if (!userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const limit = await consumeRateLimit(
    `desktop_authorize:user:${userId}`,
    AUTHORIZE_LIMIT,
    AUTHORIZE_WINDOW_SECONDS,
  )
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds)

  const result = await createDesktopAuthToken(userId)
  if (!result) {
    return Response.json({ error: 'token_creation_failed' }, { status: 503 })
  }

  const deepLink = `clarifi://auth?token=${encodeURIComponent(result.token)}`

  return Response.json({
    token: result.token,
    expiresAt: result.expiresAt,
    deepLink,
  })
}
