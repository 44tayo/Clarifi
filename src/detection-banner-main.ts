import { DETECTION_BANNER_DISMISS_MS } from '../shared/meetingDetection'

type DetectionBannerAPI = {
  takeNotes: () => Promise<unknown>
  dismiss: () => Promise<unknown>
  openApp: () => Promise<unknown>
  muteApp: () => Promise<unknown>
  openSettings: () => Promise<unknown>
  setMenuOpen: (open: boolean) => Promise<unknown>
}

declare global {
  interface Window {
    detectionBannerAPI?: DetectionBannerAPI
  }
}

export { DETECTION_BANNER_DISMISS_MS }

function readParams(): {
  kind: string
  title: string
  subtitle: string
  appName: string
  bundleId: string
} {
  const params = new URLSearchParams(window.location.search)
  const kind = params.get('kind')?.trim() || 'detection'
  if (kind === 'calendar') {
    return {
      kind,
      title: params.get('title')?.trim() || 'Meeting starting soon',
      subtitle: params.get('subtitle')?.trim() || 'Untitled meeting',
      appName: '',
      bundleId: '',
    }
  }
  return {
    kind,
    title: 'Are you in a meeting?',
    subtitle: 'Start Clarifi to take notes',
    appName: params.get('appName')?.trim() || 'this app',
    bundleId: params.get('bundleId')?.trim() || '',
  }
}

const { kind, title, subtitle, appName, bundleId } = readParams()
const titleEl = document.getElementById('title')
const subtitleEl = document.getElementById('subtitle')
const banner = document.getElementById('banner')
const shell = document.getElementById('shell')
const progressBar = document.getElementById('progressBar')
const menu = document.getElementById('menu')
const menuToggle = document.getElementById('menuToggle')
const muteAppBtn = document.getElementById('muteApp')
const muteSep = document.getElementById('muteSep')

if (titleEl) titleEl.textContent = title
if (subtitleEl) subtitleEl.textContent = subtitle
if (banner) banner.setAttribute('aria-label', title)

const canMute = kind === 'detection' && Boolean(bundleId)
if (muteAppBtn) {
  if (!canMute) {
    muteAppBtn.classList.add('is-hidden')
    muteSep?.classList.add('is-hidden')
  } else {
    muteAppBtn.textContent = `Turn off notifications for ${appName || 'this app'}`
  }
}

let dismissed = false
let menuOpen = false
let remainingMs = DETECTION_BANNER_DISMISS_MS
let deadline = Date.now() + DETECTION_BANNER_DISMISS_MS
let timer: ReturnType<typeof setTimeout> | null = null
let paused = false

const reduceMotion =
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function clearTimer(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

function dismiss(): void {
  if (dismissed) return
  dismissed = true
  clearTimer()
  void window.detectionBannerAPI?.dismiss()
}

function armTimer(ms: number): void {
  clearTimer()
  if (reduceMotion) return
  deadline = Date.now() + ms
  timer = setTimeout(() => dismiss(), ms)
}

function pause(): void {
  if (paused || dismissed || reduceMotion) return
  paused = true
  remainingMs = Math.max(0, deadline - Date.now())
  clearTimer()
  banner?.classList.add('is-paused')
}

function resume(): void {
  if (!paused || dismissed || reduceMotion || menuOpen) return
  paused = false
  banner?.classList.remove('is-paused')
  armTimer(remainingMs)
}

function setMenuOpen(open: boolean): void {
  if (dismissed) return
  menuOpen = open
  shell?.classList.toggle('menu-open', open)
  if (menu) menu.hidden = !open
  menuToggle?.setAttribute('aria-expanded', open ? 'true' : 'false')
  void window.detectionBannerAPI?.setMenuOpen(open)
  if (open) {
    pause()
  } else if (!banner?.matches(':hover')) {
    resume()
  }
}

document.getElementById('startClarifi')?.addEventListener('click', () => {
  if (dismissed) return
  dismissed = true
  clearTimer()
  void window.detectionBannerAPI?.takeNotes()
})

document.getElementById('dismiss')?.addEventListener('click', () => {
  dismiss()
})

menuToggle?.addEventListener('click', (event) => {
  event.stopPropagation()
  setMenuOpen(!menuOpen)
})

document.getElementById('openApp')?.addEventListener('click', () => {
  if (dismissed) return
  dismissed = true
  clearTimer()
  void window.detectionBannerAPI?.openApp()
})

muteAppBtn?.addEventListener('click', () => {
  if (dismissed || !canMute) return
  dismissed = true
  clearTimer()
  void window.detectionBannerAPI?.muteApp()
})

document.getElementById('openSettings')?.addEventListener('click', () => {
  if (dismissed) return
  dismissed = true
  clearTimer()
  void window.detectionBannerAPI?.openSettings()
})

banner?.addEventListener('mouseenter', () => {
  if (!menuOpen) pause()
})
banner?.addEventListener('mouseleave', () => {
  if (!menuOpen) resume()
})

document.addEventListener('click', (event) => {
  if (!menuOpen) return
  const target = event.target as Node | null
  if (menu?.contains(target) || menuToggle?.contains(target)) return
  setMenuOpen(false)
})

if (!reduceMotion && progressBar) {
  progressBar.style.setProperty('--dismiss-ms', `${DETECTION_BANNER_DISMISS_MS}ms`)
  progressBar.classList.add('is-running')
  armTimer(DETECTION_BANNER_DISMISS_MS)
}
