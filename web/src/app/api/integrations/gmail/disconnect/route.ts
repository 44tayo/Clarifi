import { disconnectGmail } from '@/lib/gmail'
import { requireIntegrationAccess } from '@/lib/integration-guard'

export async function POST(req: Request) {
  const access = await requireIntegrationAccess(req, 'gmail')
  if (access instanceof Response) return access

  const ok = await disconnectGmail(access.userId)
  return Response.json({ ok })
}
