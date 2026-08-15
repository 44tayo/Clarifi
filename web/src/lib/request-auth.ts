import { getUserIdFromDeviceRequest } from './device-auth'

export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  return getUserIdFromDeviceRequest(req)
}

export function unauthorizedResponse(): Response {
  return Response.json({ error: 'unauthorized' }, { status: 401 })
}

export function planLimitResponse(
  message: string,
  window?: 'hour' | 'day',
  retryAfterSeconds?: number,
): Response {
  return Response.json(
    {
      error: 'rate_limit',
      message,
      window,
      retry_after_seconds: retryAfterSeconds,
    },
    { status: 429 },
  )
}

export function serviceUnavailableResponse(message = 'Service temporarily unavailable'): Response {
  return Response.json({ error: 'service_unavailable', message }, { status: 503 })
}
