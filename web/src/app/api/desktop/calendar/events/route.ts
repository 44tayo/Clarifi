import { getUserIdFromDeviceRequest } from '@/lib/device-auth'
import { fetchUpcomingCalendarEvents, getCalendarStatus } from '@/lib/calendar/sync'

export async function GET(req: Request) {
  const userId = await getUserIdFromDeviceRequest(req)
  if (!userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const status = await getCalendarStatus(userId)
  if (!status.connected) {
    return Response.json({ connected: false, events: [] })
  }

  const events = await fetchUpcomingCalendarEvents(userId)
  return Response.json({ connected: true, events })
}
