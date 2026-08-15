/** Format recording elapsed time as m:ss or h:mm:ss. */
export function formatRecordingElapsed(
  startedAt: number,
  now = Date.now(),
  pausedOffsetMs = 0,
): string {
  const seconds = Math.max(0, Math.floor((now - startedAt - pausedOffsetMs) / 1000))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}
