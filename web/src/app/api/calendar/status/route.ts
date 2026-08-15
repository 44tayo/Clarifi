import { resolveIntegrationUserId } from '@/lib/integration-auth'
import { getCalendarStatus } from '@/lib/calendar/sync'

export async function GET(req: Request) {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const status = await getCalendarStatus(userId)
  return Response.json(status)
}
