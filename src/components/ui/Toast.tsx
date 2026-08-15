/**
 * Toast notification system for Clarifi desktop.
 * Renders a bottom-center stack; newest toasts appear at the bottom.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export type ToastType = 'success' | 'error' | 'info'

export type ToastOptions = {
  type?: ToastType
  duration?: number
}

type ToastItem = {
  id: string
  message: string
  type: ToastType
  duration: number
  exiting?: boolean
}

type ToastContextValue = {
  toast: (message: string, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION = 3000
const EXIT_MS = 150

function ToastIcon({ type }: { type: ToastType }) {
  if (type === 'error') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11" r="0.9" fill="currentColor" />
      </svg>
    )
  }
  if (type === 'info') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 7v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="5.2" r="0.9" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ToastPill({
  item,
  onDismiss,
}: {
  item: ToastItem
  onDismiss: (id: string) => void
}) {
  const remainingRef = useRef(item.duration)
  const startedAtRef = useRef(Date.now())
  const timerRef = useRef<number | null>(null)
  const pausedRef = useRef(false)

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const schedule = useCallback(() => {
    clearTimer()
    startedAtRef.current = Date.now()
    timerRef.current = window.setTimeout(() => {
      onDismiss(item.id)
    }, remainingRef.current)
  }, [item.id, onDismiss])

  useEffect(() => {
    remainingRef.current = item.duration
    schedule()
    return clearTimer
  }, [item.duration, schedule])

  return (
    <div
      className={`toast toast-${item.type}${item.exiting ? ' is-exiting' : ''}`}
      onMouseEnter={() => {
        if (pausedRef.current) return
        pausedRef.current = true
        clearTimer()
        remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current))
      }}
      onMouseLeave={() => {
        if (!pausedRef.current) return
        pausedRef.current = false
        schedule()
      }}
    >
      <span className="toast-icon">
        <ToastIcon type={item.type} />
      </span>
      <span className="toast-message">{item.message}</span>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)))
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, EXIT_MS)
  }, [])

  const toast = useCallback((message: string, options?: ToastOptions) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const next: ToastItem = {
      id,
      message,
      type: options?.type ?? 'success',
      duration: options?.duration ?? DEFAULT_DURATION,
    }
    setItems((prev) => [...prev, next].slice(-5))
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  const viewport =
    typeof document !== 'undefined'
      ? createPortal(
          <div className="toast-viewport" role="status" aria-live="polite" aria-relevant="additions">
            {items.map((item) => (
              <ToastPill key={item.id} item={item} onDismiss={dismiss} />
            ))}
          </div>,
          document.body,
        )
      : null

  return (
    <ToastContext.Provider value={value}>
      {children}
      {viewport}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}
