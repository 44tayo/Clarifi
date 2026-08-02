import { getUserIdFromDeviceRequest } from '@/lib/device-auth'
import {
  invalidateContactDirectoryCache,
  searchConnectedContacts,
} from '@/lib/calendar/contacts'

export async function GET(req: Request) {
  const userId = await getUserIdFromDeviceRequest(req)
  if (!userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const query = url.searchParams.get('q')?.trim() ?? ''
  // Allow clients to bust a stale empty directory after reconnect.
  if (url.searchParams.get('refresh') === '1') {
    invalidateContactDirectoryCache(userId)
  }

  try {
    const { contacts, needsReconnect, connected } = await searchConnectedContacts(userId, query)
    const withEmail = contacts.filter((person) => person.email?.trim()).length
    console.warn('[contacts] api', {
      userId: userId.slice(0, 8),
      q: query || '(directory)',
      total: contacts.length,
      withEmail,
      needsReconnect,
      connected,
    })
    return Response.json({
      connected,
      contacts,
      needsReconnect: needsReconnect || (connected && withEmail === 0),
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
