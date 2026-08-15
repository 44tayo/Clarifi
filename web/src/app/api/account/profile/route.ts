import { getServerUser } from '@/lib/auth-server'
import { updateDesktopUserProfile } from '@/lib/desktop-profile'

export async function PATCH(req: Request) {
  const user = await getServerUser()
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const payload = body as { firstName?: string; lastName?: string }
  if (typeof payload.firstName !== 'string' || typeof payload.lastName !== 'string') {
    return Response.json({ error: 'name_required' }, { status: 400 })
  }

  const result = await updateDesktopUserProfile(user.id, {
    firstName: payload.firstName,
    lastName: payload.lastName,
  })

  if (!result.ok) {
    return Response.json({ error: result.error ?? 'update_failed' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
