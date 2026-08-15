/** Compact Jamie-style drag ghost for meeting notes. */

let activeGhost: HTMLElement | null = null
let cleanupTimer: number | null = null

function cleanupGhost() {
  if (cleanupTimer != null) {
    window.clearTimeout(cleanupTimer)
    cleanupTimer = null
  }
  if (activeGhost?.parentNode) activeGhost.parentNode.removeChild(activeGhost)
  activeGhost = null
}

type DragLike = { dataTransfer: DataTransfer | null }

export function beginMeetingDrag(
  event: DragLike,
  meetingId: string,
  title: string,
  subtitle = 'Me',
): void {
  cleanupGhost()
  const dt = event.dataTransfer
  if (!dt) return
  dt.setData('application/x-clarifi-meeting', meetingId)
  dt.effectAllowed = 'copyMove'

  const ghost = document.createElement('div')
  ghost.className = 'meeting-drag-ghost'
  ghost.setAttribute('aria-hidden', 'true')

  const icon = document.createElement('span')
  icon.className = 'meeting-drag-ghost-icon'
  icon.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4.5 2.5h5l3 3V13.5a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M9.5 2.5V6h3.5M5.5 9h5M5.5 11.5h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>'

  const body = document.createElement('span')
  body.className = 'meeting-drag-ghost-body'

  const titleEl = document.createElement('span')
  titleEl.className = 'meeting-drag-ghost-title'
  titleEl.textContent = title.trim() || 'Untitled'

  const subEl = document.createElement('span')
  subEl.className = 'meeting-drag-ghost-sub'
  subEl.textContent = subtitle

  body.appendChild(titleEl)
  body.appendChild(subEl)
  ghost.appendChild(icon)
  ghost.appendChild(body)

  // Off-screen so it never flashes in the layout; browser still snapshots it.
  ghost.style.position = 'fixed'
  ghost.style.top = '-1000px'
  ghost.style.left = '-1000px'
  ghost.style.pointerEvents = 'none'
  ghost.style.zIndex = '99999'

  document.body.appendChild(ghost)
  dt.setDragImage(ghost, 18, 18)
  activeGhost = ghost

  // Keep in DOM long enough for the native drag image snapshot.
  cleanupTimer = window.setTimeout(() => cleanupGhost(), 800)
}

export function endMeetingDrag(): void {
  cleanupGhost()
}
