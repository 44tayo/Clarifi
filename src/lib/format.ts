export function formatMeetingWhen(at: number): string {
  const date = new Date(at)
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (sameDay) {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'live':
      return 'Recording'
    case 'processing':
      return 'Enhancing'
    case 'ready':
      return 'Ready'
    case 'error':
      return 'Error'
    default:
      return 'Draft'
  }
}

export function durationLabel(startedAt?: number, endedAt?: number): string | null {
  if (!startedAt) return null
  const end = endedAt ?? Date.now()
  const mins = Math.max(1, Math.round((end - startedAt) / 60_000))
  return `${mins} min`
}
