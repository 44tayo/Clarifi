import { exchangeDesktopAuthToken } from '@/lib/device-auth'
import { consumeRateLimit, getClientIp, rateLimitedResponse } from '@/lib/ip-rate-limit'

const EXCHANGE_LIMIT = 10
const EXCHANGE_WINDOW_SECONDS = 5 * 60

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const ipLimit = await consumeRateLimit(`desktop_exchange:ip:${ip}`, EXCHANGE_LIMIT, EXCHANGE_WINDOW_SECONDS)
  if (!ipLimit.allowed) return rateLimitedResponse(ipLimit.retryAfterSeconds)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const payload = body as {
    token?: string
    deviceId?: string
    deviceSecret?: string
  }

  const token = payload.token?.trim()
  const deviceId = payload.deviceId?.trim()
  const deviceSecret = payload.deviceSecret?.trim()

  if (!token || !deviceId || !deviceSecret) {
    return Response.json({ error: 'credentials_required' }, { status: 400 })
  }

  const deviceLimit = await consumeRateLimit(
    `desktop_exchange:device:${deviceId}`,
    EXCHANGE_LIMIT,
    EXCHANGE_WINDOW_SECONDS,
  )
  if (!deviceLimit.allowed) return rateLimitedResponse(deviceLimit.retryAfterSeconds)

  const result = await exchangeDesktopAuthToken(token, deviceId, deviceSecret)
  if (!result.ok) {
    const status =
      result.error === 'invalid_token' || result.error === 'token_expired' ? 400 : 500
    return Response.json({ error: result.error }, { status })
  }

  return Response.json({ ok: true })
}
