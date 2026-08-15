import type { CalendarEvent } from './calendar'

export type MicMonitorSnapshot = {
  inUse: boolean
  pids: number[]
  bundleIds: string[]
}

export type DetectedMeetingLabel = {
  title: string
  appName: string
  bundleId: string | null
}

export type DetectedMeetingPayload = DetectedMeetingLabel & {
  calendarEvent?: CalendarEvent
  suggestedTitle: string
}

/** Continuous mic-in-use before showing the banner (ms). */
export const DETECTION_DEBOUNCE_MS = 5_000
/** Idle mic before allowing another prompt for a new session (ms). */
export const DETECTION_SESSION_RESET_MS = 30_000
/** Calendar events from start−15m through end merge into the prompt. */
export const DETECTION_CALENDAR_MERGE_LEAD_MS = 15 * 60_000
/** Auto-hide the Start Clarifi banner if the user ignores it (ms). */
export const DETECTION_BANNER_DISMISS_MS = 8_000

const APP_META: Record<string, { appName: string; kind: 'huddle' | 'call' | 'meeting' }> = {
  'us.zoom.xos': { appName: 'Zoom', kind: 'meeting' },
  'com.microsoft.teams2': { appName: 'Teams', kind: 'meeting' },
  'com.microsoft.teams': { appName: 'Teams', kind: 'meeting' },
  'com.tinyspeck.slackmacgap': { appName: 'Slack', kind: 'huddle' },
  'com.hnc.Discord': { appName: 'Discord', kind: 'call' },
  'com.apple.FaceTime': { appName: 'FaceTime', kind: 'call' },
  'net.whatsapp.WhatsApp': { appName: 'WhatsApp', kind: 'call' },
  'com.google.Chrome': { appName: 'Chrome', kind: 'meeting' },
  'com.google.Chrome.canary': { appName: 'Chrome', kind: 'meeting' },
  'company.thebrowser.Browser': { appName: 'Arc', kind: 'meeting' },
  'com.brave.Browser': { appName: 'Brave', kind: 'meeting' },
  'org.mozilla.firefox': { appName: 'Firefox', kind: 'meeting' },
  'com.apple.Safari': { appName: 'Safari', kind: 'meeting' },
  'com.microsoft.edgemac': { appName: 'Edge', kind: 'meeting' },
}

const BROWSER_BUNDLES = new Set([
  'com.google.Chrome',
  'com.google.Chrome.canary',
  'company.thebrowser.Browser',
  'com.brave.Browser',
  'org.mozilla.firefox',
  'com.apple.Safari',
  'com.microsoft.edgemac',
])

/** Prefer native call apps over browsers when both appear. */
export function pickAttributedBundleId(bundleIds: string[]): string | null {
  const known = bundleIds.filter((id) => id in APP_META)
  if (known.length === 0) return bundleIds[0] ?? null
  const nonBrowser = known.find((id) => !BROWSER_BUNDLES.has(id))
  return nonBrowser ?? known[0] ?? null
}

export function labelForBundleId(bundleId: string | null): DetectedMeetingLabel {
  if (!bundleId || !(bundleId in APP_META)) {
    return { title: 'Meeting detected', appName: 'Call', bundleId }
  }
  const meta = APP_META[bundleId]!
  const title =
    meta.kind === 'huddle'
      ? 'Huddle detected'
      : meta.kind === 'call'
        ? 'Call detected'
        : 'Meeting detected'
  return { title, appName: meta.appName, bundleId }
}

export function suggestedTitleForDetection(label: DetectedMeetingLabel, calendar?: CalendarEvent): string {
  if (calendar?.title?.trim()) return calendar.title.trim()
  if (label.appName === 'Chrome' || label.appName === 'Safari' || label.appName === 'Arc' || label.appName === 'Brave' || label.appName === 'Firefox' || label.appName === 'Edge') {
    return `${label.appName} meeting`
  }
  if (label.appName === 'Slack') return 'Slack huddle'
  if (label.appName === 'FaceTime' || label.appName === 'WhatsApp' || label.appName === 'Discord') {
    return `${label.appName} call`
  }
  return `${label.appName} call`
}

export function selectOverlappingCalendarEvent(
  events: CalendarEvent[],
  nowMs: number,
  leadMs = DETECTION_CALENDAR_MERGE_LEAD_MS,
): CalendarEvent | undefined {
  let best: CalendarEvent | undefined
  let bestDist = Number.POSITIVE_INFINITY
  for (const event of events) {
    const start = Date.parse(event.startAt)
    const end = Date.parse(event.endAt)
    if (Number.isNaN(start)) continue
    const windowStart = start - leadMs
    const windowEnd = Number.isNaN(end) ? start + 60 * 60_000 : end
    if (nowMs < windowStart || nowMs > windowEnd) continue
    const dist = Math.abs(nowMs - start)
    if (dist < bestDist) {
      best = event
      bestDist = dist
    }
  }
  return best
}

export type DetectionTickDecision =
  | { action: 'none' }
  | { action: 'prompt'; label: DetectedMeetingLabel }
  | { action: 'reset_session' }

/**
 * Pure state machine for mic-session detection.
 * `promptedThisSession` prevents repeat banners until mic goes idle for resetMs.
 */
export function decideDetectionTick(input: {
  snapshot: MicMonitorSnapshot
  nowMs: number
  micActiveSinceMs: number | null
  lastIdleAtMs: number | null
  promptedThisSession: boolean
  suppress: boolean
  mutedBundleIds?: readonly string[]
  debounceMs?: number
  resetMs?: number
}): {
  decision: DetectionTickDecision
  micActiveSinceMs: number | null
  lastIdleAtMs: number | null
  promptedThisSession: boolean
} {
  const debounceMs = input.debounceMs ?? DETECTION_DEBOUNCE_MS
  const resetMs = input.resetMs ?? DETECTION_SESSION_RESET_MS
  const { snapshot, nowMs, suppress } = input
  let { micActiveSinceMs, lastIdleAtMs, promptedThisSession } = input

  if (!snapshot.inUse) {
    if (lastIdleAtMs == null) lastIdleAtMs = nowMs
    micActiveSinceMs = null
    if (promptedThisSession && nowMs - lastIdleAtMs >= resetMs) {
      return {
        decision: { action: 'reset_session' },
        micActiveSinceMs: null,
        lastIdleAtMs,
        promptedThisSession: false,
      }
    }
    return {
      decision: { action: 'none' },
      micActiveSinceMs: null,
      lastIdleAtMs,
      promptedThisSession,
    }
  }

  lastIdleAtMs = null
  if (micActiveSinceMs == null) micActiveSinceMs = nowMs

  if (suppress || promptedThisSession) {
    return { decision: { action: 'none' }, micActiveSinceMs, lastIdleAtMs, promptedThisSession }
  }

  if (nowMs - micActiveSinceMs < debounceMs) {
    return { decision: { action: 'none' }, micActiveSinceMs, lastIdleAtMs, promptedThisSession }
  }

  const bundleId = pickAttributedBundleId(snapshot.bundleIds)
  // Require a known/attributed meeting app (or any bundle) so random mic use is quieter.
  if (!bundleId && snapshot.bundleIds.length === 0) {
    return { decision: { action: 'none' }, micActiveSinceMs, lastIdleAtMs, promptedThisSession }
  }

  const muted = input.mutedBundleIds ?? []
  if (bundleId && muted.includes(bundleId)) {
    return { decision: { action: 'none' }, micActiveSinceMs, lastIdleAtMs, promptedThisSession }
  }

  const label = labelForBundleId(bundleId)
  return {
    decision: { action: 'prompt', label },
    micActiveSinceMs,
    lastIdleAtMs,
    promptedThisSession: true,
  }
}

export function buildDetectedMeetingPayload(
  label: DetectedMeetingLabel,
  events: CalendarEvent[],
  nowMs: number,
): DetectedMeetingPayload {
  const calendarEvent = selectOverlappingCalendarEvent(events, nowMs)
  return {
    ...label,
    calendarEvent,
    suggestedTitle: suggestedTitleForDetection(label, calendarEvent),
  }
}
