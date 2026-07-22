const pendingMeetingIds = new Set<string>()
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryInFlight = false
let enhanceRunner: ((meetingId: string) => Promise<{ status?: string } | null>) | null = null

const RETRY_DELAY_MS = 15_000

export function registerEnhanceRunner(
  runner: (meetingId: string) => Promise<{ status?: string } | null>,
): void {
  enhanceRunner = runner
}

export function queueEnhanceRetry(meetingId: string): void {
  pendingMeetingIds.add(meetingId)
  scheduleEnhanceRetry()
}

export function clearEnhanceRetry(meetingId: string): void {
  pendingMeetingIds.delete(meetingId)
}

export function getPendingEnhanceIds(): string[] {
  return Array.from(pendingMeetingIds)
}

function scheduleEnhanceRetry(): void {
  if (retryTimer || !enhanceRunner) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    void flushEnhanceRetryQueue(enhanceRunner!)
  }, RETRY_DELAY_MS)
}

export async function flushEnhanceRetryQueue(
  enhance: (meetingId: string) => Promise<{ status?: string } | null>,
): Promise<void> {
  if (retryInFlight || pendingMeetingIds.size === 0) return
  retryInFlight = true
  try {
    const ids = Array.from(pendingMeetingIds)
    for (const meetingId of ids) {
      const result = await enhance(meetingId)
      if (result && result.status === 'ready') {
        pendingMeetingIds.delete(meetingId)
      }
    }
    if (pendingMeetingIds.size > 0) {
      scheduleEnhanceRetry()
    }
  } finally {
    retryInFlight = false
  }
}
