export const LAUNCH_PREVIEW_COOKIE = 'clarifi_launch_preview'

/** @deprecated Use LAUNCH_PREVIEW_COOKIE */
export const DEV_LAUNCH_PREVIEW_COOKIE = LAUNCH_PREVIEW_COOKIE

export type SearchParamsLike =
  | { get(name: string): string | null | undefined }
  | { preview?: string | null | undefined }

function getPreviewParam(searchParams?: SearchParamsLike | null): string | null | undefined {
  if (!searchParams) return undefined
  if ('get' in searchParams && typeof searchParams.get === 'function') {
    return searchParams.get('preview')
  }
  if ('preview' in searchParams) {
    return searchParams.preview
  }
  return undefined
}

export type LaunchPreviewState = {
  previewLive: boolean
  forceWaitlist: boolean
}

/** ?preview=live forces post-launch UI; ?preview=waitlist forces waitlist UI. */
export function resolveLaunchPreviewState(
  searchParams?: SearchParamsLike | null,
  cookieValue?: string | null,
): LaunchPreviewState {
  const preview = getPreviewParam(searchParams)
  if (preview === 'waitlist') return { previewLive: false, forceWaitlist: true }
  if (preview === 'live') return { previewLive: true, forceWaitlist: false }
  if (cookieValue === '1') return { previewLive: true, forceWaitlist: false }
  return { previewLive: false, forceWaitlist: false }
}

/** @deprecated Use resolveLaunchPreviewState */
export function resolveDevLaunchPreview(
  searchParams?: SearchParamsLike | null,
  cookieValue?: string | null,
): boolean {
  return resolveLaunchPreviewState(searchParams, cookieValue).previewLive
}

export function launchPreviewCookieOptions() {
  return {
    path: '/',
    sameSite: 'lax' as const,
    httpOnly: false,
    maxAge: 60 * 60 * 24,
  }
}

/** @deprecated Use launchPreviewCookieOptions */
export function devLaunchPreviewCookieOptions() {
  return launchPreviewCookieOptions()
}

function readPreviewCookieClient(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${LAUNCH_PREVIEW_COOKIE}=`))
  return match?.split('=')[1] ?? null
}

export function previewHref(path: string): string {
  if (typeof window === 'undefined') return path
  const { previewLive } = resolveLaunchPreviewState(
    { preview: new URLSearchParams(window.location.search).get('preview') },
    readPreviewCookieClient(),
  )
  if (!previewLive) return path
  const [base, query = ''] = path.split('?')
  const params = new URLSearchParams(query)
  params.set('preview', 'live')
  const qs = params.toString()
  return qs ? `${base}?${qs}` : path
}

/** @deprecated Use previewHref */
export function devPreviewHref(path: string): string {
  return previewHref(path)
}
