import { deleteCalendarConnection } from '@/lib/calendar/connections'
import type { CalendarProvider } from '@/lib/calendar/types'
import { getUserIdFromDeviceRequest } from '@/lib/device-auth'

function parseProvider(value: unknown): CalendarProvider | null {
  if (value === 'google' || value === 'microsoft') return value
  return null
}

/** Disconnect a calendar provider for the paired desktop account. */
export async function POST(req: Request) {
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

  const provider = parseProvider((body as { provider?: unknown }).provider)
  if (!provider) {
    return Response.json({ error: 'invalid_provider' }, { status: 400 })
  }

  const ok = await deleteCalendarConnection(userId, provider)
  if (!ok) {
    return Response.json({ error: 'disconnect_failed' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
