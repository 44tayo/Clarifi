import { DETECTION_BANNER_DISMISS_MS } from '../shared/meetingDetection'

type DetectionBannerAPI = {
  takeNotes: () => Promise<unknown>
  dismiss: () => Promise<unknown>
}

declare global {
  interface Window {
    detectionBannerAPI?: DetectionBannerAPI
  }
}

export { DETECTION_BANNER_DISMISS_MS }

function readParams(): { title: string; appName: string } {
  const params = new URLSearchParams(window.location.search)
  return {
    title: params.get('title')?.trim() || 'Meeting detected',
    appName: params.get('appName')?.trim() || 'Call',
  }
}

const { title, appName } = readParams()
const titleEl = document.getElementById('title')
const appEl = document.getElementById('appName')
const banner = document.getElementById('banner')
const progressBar = document.getElementById('progressBar')

if (titleEl) titleEl.textContent = title
if (appEl) appEl.textContent = appName

let dismissed = false
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
  if (!paused || dismissed || reduceMotion) return
  paused = false
  banner?.classList.remove('is-paused')
  armTimer(remainingMs)
}

document.getElementById('takeNotes')?.addEventListener('click', () => {
  if (dismissed) return
  dismissed = true
  clearTimer()
  void window.detectionBannerAPI?.takeNotes()
})

document.getElementById('dismiss')?.addEventListener('click', () => {
  dismiss()
})

banner?.addEventListener('mouseenter', () => pause())
banner?.addEventListener('mouseleave', () => resume())

if (!reduceMotion && progressBar) {
  progressBar.style.setProperty('--dismiss-ms', `${DETECTION_BANNER_DISMISS_MS}ms`)
  progressBar.classList.add('is-running')
  armTimer(DETECTION_BANNER_DISMISS_MS)
}
