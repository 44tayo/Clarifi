/** Public launch — live since June 1, 2026 */
export const WAITLIST_LAUNCH_AT = new Date('2026-06-01T00:00:00.000Z')

export function isLaunchLive(
  now = Date.now(),
  previewLive = false,
  forceWaitlist = false,
): boolean {
  if (forceWaitlist) return false
  if (previewLive) return true
  return now >= WAITLIST_LAUNCH_AT.getTime()
}

export function getLaunchCountdown(
  now = Date.now(),
  previewLive = false,
  forceWaitlist = false,
) {
  const diff = Math.max(0, WAITLIST_LAUNCH_AT.getTime() - now)
  const totalSeconds = Math.floor(diff / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return {
    days,
    hours,
    minutes,
    seconds,
    isLive: isLaunchLive(now, previewLive, forceWaitlist),
  }
}
