import { disconnectGmail } from '@/lib/gmail'
import { resolveIntegrationUserId } from '@/lib/integration-auth'

export async function POST(req: Request) {
  const userId = await resolveIntegrationUserId(req)
  if (!userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const ok = await disconnectGmail(userId)
  return Response.json({ ok })
}
