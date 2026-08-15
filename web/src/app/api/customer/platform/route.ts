import { getServerUser } from '@/lib/auth-server'
import { parseCustomerPlatformBody, setCustomerPlatform } from '@/lib/customer-platform'
import { detectPlatformFromUserAgent } from '@/lib/platform'

export async function POST(req: Request) {
  const user = await getServerUser()
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { platform?: string } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const platform =
    parseCustomerPlatformBody(body.platform) ??
    detectPlatformFromUserAgent(req.headers.get('user-agent') ?? '')

  if (!platform) {
    return Response.json({ error: 'platform_unknown' }, { status: 400 })
  }

  const ok = await setCustomerPlatform(user.id, platform)
  if (!ok) {
    return Response.json({ error: 'save_failed' }, { status: 503 })
  }

  return Response.json({ ok: true, platform })
}
