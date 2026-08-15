/**
 * Local chat thread retention helpers (renderer localStorage keys).
 */

export const CHAT_THREAD_PREFIX = 'clarifi-chat-thread:'

export function listChatThreadKeys(storageKeys: string[]): string[] {
  return storageKeys.filter((key) => key.startsWith(CHAT_THREAD_PREFIX))
}

export function purgeChatThreads(
  storage: { removeItem: (key: string) => void },
  keys: string[],
): number {
  let removed = 0
  for (const key of keys) {
    if (!key.startsWith(CHAT_THREAD_PREFIX)) continue
    storage.removeItem(key)
    removed += 1
  }
  return removed
}

export function shouldPurgeMeetingByAge(
  meetingAt: number,
  now: number,
  retentionDays: number,
): boolean {
  if (!Number.isFinite(meetingAt) || retentionDays <= 0) return false
  return now - meetingAt > retentionDays * 24 * 60 * 60 * 1000
}
