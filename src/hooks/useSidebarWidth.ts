import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

const STORAGE_KEY = 'clarifi.sidebarWidth'
export const SIDEBAR_WIDTH_DEFAULT = 280
export const SIDEBAR_WIDTH_MIN = 200
export const SIDEBAR_WIDTH_MAX = 420

function clampWidth(value: number): number {
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, Math.round(value)))
}

function readStoredWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return SIDEBAR_WIDTH_DEFAULT
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return SIDEBAR_WIDTH_DEFAULT
    return clampWidth(parsed)
  } catch {
    return SIDEBAR_WIDTH_DEFAULT
  }
}

function persistWidth(width: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(width))
  } catch {
    // ignore quota / private mode
  }
}

export function useSidebarWidth() {
  const [width, setWidth] = useState(SIDEBAR_WIDTH_DEFAULT)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef(false)

  useEffect(() => {
    setWidth(readStoredWidth())
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--ds-sidebar-width', `${width}px`)
  }, [width])

  useEffect(() => {
    if (!dragging) return
    document.body.classList.add('is-sidebar-resizing')
    return () => document.body.classList.remove('is-sidebar-resizing')
  }, [dragging])

  const onResizePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragRef.current = true
    setDragging(true)

    const onMove = (moveEvent: PointerEvent) => {
      if (!dragRef.current) return
      setWidth(clampWidth(moveEvent.clientX))
    }

    const onUp = (upEvent: PointerEvent) => {
      if (!dragRef.current) return
      dragRef.current = false
      setDragging(false)
      const next = clampWidth(upEvent.clientX)
      setWidth(next)
      persistWidth(next)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }, [])

  const resetWidth = useCallback(() => {
    setWidth(SIDEBAR_WIDTH_DEFAULT)
    persistWidth(SIDEBAR_WIDTH_DEFAULT)
  }, [])

  return { width, dragging, onResizePointerDown, resetWidth }
}
