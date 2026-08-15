export type WidgetMode = 'compact' | 'expanded'
export type WidgetPanel = 'notepad' | 'transcript'

export const WIDGET_SIZES: Record<WidgetMode, { width: number; height: number }> = {
  compact: { width: 168, height: 46 },
  expanded: { width: 480, height: 640 },
}

export const WIDGET_EXPANDED_MIN = { width: 360, height: 420 }
export const WIDGET_EXPANDED_MAX = { width: 720, height: 900 }

export function widgetBoundsForMode(
  mode: WidgetMode,
  anchor: { x: number; y: number; width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const size = WIDGET_SIZES[mode]
  const x = anchor.x + anchor.width - size.width
  const y = anchor.y
  return { x, y, width: size.width, height: size.height }
}
