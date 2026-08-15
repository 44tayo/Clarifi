import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { authCallbackRedirectPath } from '@/lib/auth-callback-redirect'
import { AUTH_NEXT_COOKIE } from '@/lib/auth-next'

export async function redirectOAuthCodeIfPresent(
  params: Record<string, string | string[] | undefined>,
): Promise<void> {
  if (typeof params.code !== 'string') return

  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') q.set(key, value)
  }

  const cookieStore = await cookies()
  const authNext = cookieStore.get(AUTH_NEXT_COOKIE)?.value ?? null
  const target = authCallbackRedirectPath(q, authNext)
  if (target) redirect(target)
}
