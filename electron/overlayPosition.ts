import { app, BrowserWindow, Display, screen } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export const OVERLAY_WIDTH = 640
export const OVERLAY_HEIGHT_COLLAPSED = 168
export const OVERLAY_HEIGHT_EXPANDED = 360
export const OVERLAY_HEIGHT_CHAT = 480

export const OVERLAY_MIN_WIDTH = 480
export const OVERLAY_MAX_WIDTH = 900
export const OVERLAY_MIN_HEIGHT = 168
export const OVERLAY_MAX_HEIGHT = 700

const POSITION_FILE = 'overlay-position.json'
const SIZE_FILE = 'overlay-size.json'
const TOP_MARGIN = 20
const POLL_INTERVAL_MS = 500

type OverlayPosition = {
  x: number
  y: number
}

type OverlaySize = {
  width: number
  height: number
}

type PositionStore = OverlayPosition & {
  byDisplay?: Record<string, OverlayPosition>
}

type RelativePosition = {
  xRatio: number
  yRatio: number
}

let followEnabled = true
let followPollTimer: NodeJS.Timeout | null = null
let lastFollowedDisplayId: number | null = null
let isProgrammaticMove = false
let overlayWindowRef: BrowserWindow | null = null

function getPositionFilePath(): string {
  return path.join(app.getPath('userData'), POSITION_FILE)
}

function getSizeFilePath(): string {
  return path.join(app.getPath('userData'), SIZE_FILE)
}

function loadPositionStore(): PositionStore | null {
  try {
    const raw = fs.readFileSync(getPositionFilePath(), 'utf-8')
    const parsed = JSON.parse(raw) as PositionStore
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return parsed
    }
  } catch {
    // No saved position yet
  }
  return null
}

function savePositionStore(x: number, y: number, displayId?: number): void {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    const existing = loadPositionStore()
    const store: PositionStore = {
      x,
      y,
      byDisplay: { ...existing?.byDisplay },
    }
    if (displayId !== undefined) {
      store.byDisplay = store.byDisplay ?? {}
      store.byDisplay[String(displayId)] = { x, y }
    }
    fs.writeFileSync(getPositionFilePath(), JSON.stringify(store))
  } catch (err) {
    console.error('Failed to save overlay position:', err)
  }
}

export function loadOverlayPosition(): OverlayPosition | null {
  const store = loadPositionStore()
  if (!store) return null
  return { x: store.x, y: store.y }
}

export function saveOverlayPosition(x: number, y: number): void {
  savePositionStore(x, y)
}

export function loadOverlaySize(): OverlaySize {
  try {
    const raw = fs.readFileSync(getSizeFilePath(), 'utf-8')
    const parsed = JSON.parse(raw) as OverlaySize
    if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
      return clampSize(parsed.width, parsed.height)
    }
  } catch {
    // No saved size yet
  }
  return { width: OVERLAY_WIDTH, height: OVERLAY_HEIGHT_COLLAPSED }
}

export function saveOverlaySize(width: number, height: number): void {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    const clamped = clampSize(width, height)
    fs.writeFileSync(getSizeFilePath(), JSON.stringify(clamped))
  } catch (err) {
    console.error('Failed to save overlay size:', err)
  }
}

export function clampSize(width: number, height: number): OverlaySize {
  return {
    width: Math.max(OVERLAY_MIN_WIDTH, Math.min(width, OVERLAY_MAX_WIDTH)),
    height: Math.max(OVERLAY_MIN_HEIGHT, Math.min(height, OVERLAY_MAX_HEIGHT)),
  }
}

export function getTopCenterPosition(
  display: Display,
  width: number,
  height: number,
): OverlayPosition {
  const area = display.workArea
  return {
    x: Math.round(area.x + (area.width - width) / 2),
    y: area.y + TOP_MARGIN,
  }
}

export function getDefaultPosition(width: number, height: number): OverlayPosition {
  const primary = screen.getPrimaryDisplay()
  return getTopCenterPosition(primary, width, height)
}

/** Move overlay to top-center of the display under the cursor (or primary). */
export function repositionOverlayToTopCenter(window: BrowserWindow): void {
  if (window.isDestroyed()) return
  const { width, height } = window.getBounds()
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const pos = getTopCenterPosition(display, width, height)
  setOverlayBounds(window, pos.x, pos.y, width, height, true)
  saveOverlayPosition(pos.x, pos.y)
}

export function clampPosition(
  x: number,
  y: number,
  width: number,
  height: number,
): OverlayPosition {
  const display = screen.getDisplayNearestPoint({ x, y })
  const area = display.workArea
  return {
    x: Math.max(area.x, Math.min(x, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(y, area.y + area.height - height)),
  }
}

function getRelativePosition(
  x: number,
  y: number,
  width: number,
  display: Display,
): RelativePosition {
  const area = display.workArea
  const xRatio = area.width > width
    ? (x - area.x) / (area.width - width)
    : 0
  const yRatio = area.height > 0 ? (y - area.y) / area.height : 0
  return {
    xRatio: Math.max(0, Math.min(1, xRatio)),
    yRatio: Math.max(0, Math.min(1, yRatio)),
  }
}

function applyRelativePosition(
  relative: RelativePosition,
  display: Display,
  width: number,
  height: number,
): OverlayPosition {
  const area = display.workArea
  const x = Math.round(
    area.x + relative.xRatio * Math.max(0, area.width - width),
  )
  const y = Math.round(
    area.y + relative.yRatio * Math.max(0, area.height - height),
  )
  return clampPosition(x, y, width, height)
}

function getSavedPositionForDisplay(
  displayId: number,
  display: Display,
  width: number,
  height: number,
): OverlayPosition {
  const store = loadPositionStore()
  const saved = store?.byDisplay?.[String(displayId)]
  if (saved) {
    return clampPosition(saved.x, saved.y, width, height)
  }

  if (store) {
    const sourceDisplay = screen.getDisplayNearestPoint({ x: store.x, y: store.y })
    const relative = getRelativePosition(store.x, store.y, width, sourceDisplay)
    return applyRelativePosition(relative, display, width, height)
  }

  return getTopCenterPosition(display, width, height)
}

export function setOverlayBounds(
  window: BrowserWindow,
  x: number,
  y: number,
  width: number,
  height: number,
  programmatic = true,
): void {
  if (window.isDestroyed()) return
  const clampedSize = clampSize(width, height)
  const clamped = clampPosition(x, y, clampedSize.width, clampedSize.height)
  isProgrammaticMove = programmatic
  window.setBounds({
    x: clamped.x,
    y: clamped.y,
    width: clampedSize.width,
    height: clampedSize.height,
  })
  if (programmatic) {
    setImmediate(() => {
      isProgrammaticMove = false
    })
  }
}

export function onOverlayMoved(window: BrowserWindow): void {
  if (isProgrammaticMove || window.isDestroyed()) return
  const [x, y] = window.getPosition()
  const display = screen.getDisplayNearestPoint({ x, y })
  savePositionStore(x, y, display.id)
  lastFollowedDisplayId = display.id
}

function followActiveDisplay(window: BrowserWindow): void {
  if (!followEnabled || window.isDestroyed() || !window.isVisible()) return

  const cursor = screen.getCursorScreenPoint()
  const targetDisplay = screen.getDisplayNearestPoint(cursor)
  const [wx, wy] = window.getPosition()
  const currentDisplay = screen.getDisplayNearestPoint({ x: wx, y: wy })

  if (targetDisplay.id === currentDisplay.id) {
    lastFollowedDisplayId = targetDisplay.id
    return
  }

  const { width, height } = window.getBounds()
  const pos = getSavedPositionForDisplay(targetDisplay.id, targetDisplay, width, height)
  lastFollowedDisplayId = targetDisplay.id
  setOverlayBounds(window, pos.x, pos.y, width, height, true)
}

function onDisplayMetricsChanged(): void {
  if (!overlayWindowRef || overlayWindowRef.isDestroyed()) return
  const [x, y] = overlayWindowRef.getPosition()
  const { width, height } = overlayWindowRef.getBounds()
  const clamped = clampPosition(x, y, width, height)
  setOverlayBounds(overlayWindowRef, clamped.x, clamped.y, width, height, true)
}

export function setFollowEnabled(enabled: boolean): void {
  followEnabled = enabled
}

export function startOverlayFollow(window: BrowserWindow): void {
  overlayWindowRef = window
  window.setAlwaysOnTop(true, 'floating', 1)

  const [x, y] = window.getPosition()
  lastFollowedDisplayId = screen.getDisplayNearestPoint({ x, y }).id

  screen.on('display-metrics-changed', onDisplayMetricsChanged)

  if (followPollTimer) {
    clearInterval(followPollTimer)
  }

  followPollTimer = setInterval(() => {
    if (overlayWindowRef && !overlayWindowRef.isDestroyed()) {
      followActiveDisplay(overlayWindowRef)
    }
  }, POLL_INTERVAL_MS)
}

export function stopOverlayFollow(): void {
  screen.removeListener('display-metrics-changed', onDisplayMetricsChanged)
  if (followPollTimer) {
    clearInterval(followPollTimer)
    followPollTimer = null
  }
  overlayWindowRef = null
}

export function toggleOverlayFollow(): boolean {
  followEnabled = !followEnabled
  if (followEnabled && overlayWindowRef && !overlayWindowRef.isDestroyed()) {
    followActiveDisplay(overlayWindowRef)
  }
  return followEnabled
}

export function isOverlayFollowEnabled(): boolean {
  return followEnabled
}
