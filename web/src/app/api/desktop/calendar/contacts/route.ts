import { getUserIdFromDeviceRequest } from '@/lib/device-auth'
import { searchConnectedContacts } from '@/lib/calendar/contacts'

export async function GET(req: Request) {
  const userId = await getUserIdFromDeviceRequest(req)
  if (!userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const query = url.searchParams.get('q')?.trim() ?? ''

  try {
    const { contacts, needsReconnect } = await searchConnectedContacts(userId, query)
    return Response.json({
      connected: true,
      contacts,
      needsReconnect,
    })
  } catch (error) {
    console.error('contacts search failed:', error)
    return Response.json({
      connected: true,
      contacts: [],
      needsReconnect: true,
      error: 'search_failed',
    })
  }
}
