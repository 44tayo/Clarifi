import { cookies } from 'next/headers'
import {
  LAUNCH_PREVIEW_COOKIE,
  launchPreviewCookieOptions,
  resolveLaunchPreviewState,
  type LaunchPreviewState,
} from '@/lib/launch-preview'

export async function getServerLaunchPreviewState(
  previewFromQuery?: string | null,
): Promise<LaunchPreviewState> {
  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(LAUNCH_PREVIEW_COOKIE)?.value ?? null
  return resolveLaunchPreviewState(
    previewFromQuery != null ? { preview: previewFromQuery } : null,
    cookieValue,
  )
}

export async function getServerDevLaunchPreview(
  previewFromQuery?: string | null,
): Promise<boolean> {
  const state = await getServerLaunchPreviewState(previewFromQuery)
  return state.previewLive
}

export function applyLaunchPreviewCookies(
  response: {
    cookies: {
      set: (name: string, value: string, options?: object) => void
      delete: (name: string) => void
    }
  },
  preview: string | null,
): void {
  if (!preview) return

  if (preview === 'live') {
    response.cookies.set(LAUNCH_PREVIEW_COOKIE, '1', launchPreviewCookieOptions())
    return
  }

  if (preview === 'waitlist') {
    response.cookies.delete(LAUNCH_PREVIEW_COOKIE)
  }
}

/** @deprecated Use applyLaunchPreviewCookies */
export function applyDevLaunchPreviewCookies(
  response: Parameters<typeof applyLaunchPreviewCookies>[0],
  preview: string | null,
): void {
  applyLaunchPreviewCookies(response, preview)
}
