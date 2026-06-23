import { desktopCapturer, screen, systemPreferences } from 'electron'
import { getOverlayWindow, reapplyOverlayWindowPolicies, setOverlayInteractive } from './overlay'

const MAX_CAPTURE_DIMENSION = 1568
const OVERLAY_HIDE_MS = 120

export type ScreenCaptureResult =
  | { imageBase64: string; mimeType: 'image/png' }
  | { error: string }

/**
 * Captures the display under the cursor for LLM screen context.
 * Temporarily hides the overlay window so it is excluded from the screenshot.
 */
export async function captureScreenForContext(): Promise<ScreenCaptureResult> {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('screen')
    if (status !== 'granted') {
      return { error: 'permission_denied' }
    }
  }

  const overlay = getOverlayWindow()
  const wasOverlayVisible =
    overlay !== null && !overlay.isDestroyed() && overlay.isVisible()

  try {
    if (overlay && !overlay.isDestroyed() && wasOverlayVisible) {
      overlay.hide()
      await delay(OVERLAY_HIDE_MS)
    }

    const cursor = screen.getCursorScreenPoint()
    const display = screen.getDisplayNearestPoint(cursor)
    const { width, height } = scaleCaptureSize(
      display.size.width,
      display.size.height,
      display.scaleFactor,
    )

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height },
    })

    if (sources.length === 0) {
      return { error: 'permission_denied' }
    }

    const source =
      sources.find((s) => s.display_id === String(display.id)) ?? sources[0]

    const thumbnail = source.thumbnail
    if (!thumbnail || thumbnail.isEmpty()) {
      return { error: 'capture_failed' }
    }

    const pngBuffer = thumbnail.toPNG()
    if (pngBuffer.length === 0) {
      return { error: 'capture_failed' }
    }

    return {
      imageBase64: pngBuffer.toString('base64'),
      mimeType: 'image/png',
    }
  } catch (err) {
    console.error('Screen capture error:', err)
    return { error: 'capture_failed' }
  } finally {
    if (overlay && !overlay.isDestroyed() && wasOverlayVisible) {
      overlay.show()
      setOverlayInteractive(true)
      reapplyOverlayWindowPolicies()
    }
  }
}

function scaleCaptureSize(
  logicalWidth: number,
  logicalHeight: number,
  scaleFactor: number,
): { width: number; height: number } {
  let width = Math.round(logicalWidth * scaleFactor)
  let height = Math.round(logicalHeight * scaleFactor)
  const longest = Math.max(width, height)

  if (longest > MAX_CAPTURE_DIMENSION) {
    const ratio = MAX_CAPTURE_DIMENSION / longest
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }

  return { width, height }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
