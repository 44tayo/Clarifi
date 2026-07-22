import { getSharedMeetingByToken } from '@/lib/share-notes'

type RouteContext = { params: Promise<{ token: string }> }

export async function GET(_req: Request, context: RouteContext) {
  const { token } = await context.params
  if (!token) return Response.json({ error: 'not_found' }, { status: 404 })

  const shared = await getSharedMeetingByToken(token)
  if (!shared) return Response.json({ error: 'not_found' }, { status: 404 })

  return Response.json({
    title: shared.title,
    content: shared.content,
    createdAt: shared.createdAt,
  })
}
