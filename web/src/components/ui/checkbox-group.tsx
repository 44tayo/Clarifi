'use client'

import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { AnimatePresence, motion } from 'framer-motion'
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react'

import { cn } from '@/lib/utils'

const springs = {
  fast: { type: 'spring' as const, duration: 0.08, bounce: 0 },
  moderate: { type: 'spring' as const, duration: 0.16, bounce: 0.15 },
}

const shape = {
  bg: 'rounded-[20px]',
  item: 'rounded-[20px]',
  focusRing: 'rounded-[20px]',
  mergedBg: 'rounded-[20px]',
}

interface ItemRect {
  top: number
  height: number
  left: number
  width: number
}

function useProximityHover<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  options: { axis?: 'x' | 'y' } = {},
) {
  const { axis = 'y' } = options
  const itemsRef = useRef(new Map<number, HTMLElement>())
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [itemRects, setItemRects] = useState<ItemRect[]>([])
  const itemRectsRef = useRef<ItemRect[]>([])
  const sessionRef = useRef(0)
  const rafIdRef = useRef<number | null>(null)

  const registerItem = useCallback((index: number, element: HTMLElement | null) => {
    if (element) itemsRef.current.set(index, element)
    else itemsRef.current.delete(index)
  }, [])

  const measureItems = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    const scrollTop = container.scrollTop
    const scrollLeft = container.scrollLeft
    const borderTop = container.clientTop
    const borderLeft = container.clientLeft
    const rects: ItemRect[] = []
    itemsRef.current.forEach((element, index) => {
      const rect = element.getBoundingClientRect()
      rects[index] = {
        top: rect.top - containerRect.top + scrollTop - borderTop,
        height: rect.height,
        left: rect.left - containerRect.left + scrollLeft - borderLeft,
        width: rect.width,
      }
    })
    itemRectsRef.current = rects
    setItemRects(rects)
  }, [containerRef])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const mouseX = e.clientX
      const mouseY = e.clientY
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null
        const container = containerRef.current
        if (!container) return
        const containerRect = container.getBoundingClientRect()
        const mousePos = axis === 'x' ? mouseX : mouseY
        let closestIndex: number | null = null
        let closestDistance = Infinity
        let containingIndex: number | null = null
        const rects = itemRectsRef.current
        const scrollOffset = axis === 'x' ? container.scrollLeft : container.scrollTop
        const borderOffset = axis === 'x' ? container.clientLeft : container.clientTop
        const containerEdge = axis === 'x' ? containerRect.left : containerRect.top
        for (let index = 0; index < rects.length; index++) {
          const r = rects[index]
          if (!r) continue
          const contentPos = axis === 'x' ? r.left : r.top
          const itemStart = containerEdge + borderOffset + contentPos - scrollOffset
          const itemSize = axis === 'x' ? r.width : r.height
          const itemEnd = itemStart + itemSize
          if (mousePos >= itemStart && mousePos <= itemEnd) containingIndex = index
          const itemCenter = itemStart + itemSize / 2
          const distance = Math.abs(mousePos - itemCenter)
          if (distance < closestDistance) {
            closestDistance = distance
            closestIndex = index
          }
        }
        setActiveIndex(containingIndex ?? closestIndex)
      })
    },
    [axis, containerRef],
  )

  const handleMouseEnter = useCallback(() => {
    sessionRef.current += 1
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    setActiveIndex(null)
  }, [])

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
    }
  }, [])

  return {
    activeIndex,
    setActiveIndex,
    itemRects,
    sessionRef,
    handlers: {
      onMouseMove: handleMouseMove,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
    registerItem,
    measureItems,
  }
}

interface CheckboxGroupContextValue {
  registerItem: (index: number, element: HTMLElement | null) => void
  activeIndex: number | null
}

const CheckboxGroupContext = createContext<CheckboxGroupContextValue | null>(null)

function useCheckboxGroup() {
  const ctx = useContext(CheckboxGroupContext)
  if (!ctx) throw new Error('useCheckboxGroup must be used within a CheckboxGroup')
  return ctx
}

interface CheckboxGroupProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  checkedIndices: Set<number>
}

const CheckboxGroup = forwardRef<HTMLDivElement, CheckboxGroupProps>(
  ({ children, checkedIndices, className, ...props }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const groupIdCounter = useRef(0)
    const prevGroupMap = useRef(new Map<number, number>())

    const { activeIndex, setActiveIndex, itemRects, sessionRef, handlers, registerItem, measureItems } =
      useProximityHover(containerRef)

    useEffect(() => {
      measureItems()
    }, [measureItems, children])

    const runs: { start: number; end: number }[] = []
    const sortedChecked = [...checkedIndices].sort((a, b) => a - b)
    for (const idx of sortedChecked) {
      const last = runs[runs.length - 1]
      if (last && idx === last.end + 1) last.end = idx
      else runs.push({ start: idx, end: idx })
    }

    const usedIds = new Set<number>()
    const newGroupMap = new Map<number, number>()
    const checkedGroups = runs.map((run) => {
      let stableId: number | null = null
      for (let i = run.start; i <= run.end; i++) {
        const prevId = prevGroupMap.current.get(i)
        if (prevId !== undefined && !usedIds.has(prevId)) {
          stableId = prevId
          break
        }
      }
      const id = stableId ?? ++groupIdCounter.current
      usedIds.add(id)
      for (let i = run.start; i <= run.end; i++) newGroupMap.set(i, id)
      return { ...run, id }
    })
    prevGroupMap.current = newGroupMap

    const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
    const activeRect = activeIndex !== null ? itemRects[activeIndex] : null
    const focusRect = focusedIndex !== null ? itemRects[focusedIndex] : null
    const isHoveringOther = activeIndex !== null && !checkedIndices.has(activeIndex)

    return (
      <CheckboxGroupContext.Provider value={{ registerItem, activeIndex }}>
        <div
          ref={(node) => {
            containerRef.current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
          }}
          onMouseEnter={handlers.onMouseEnter}
          onMouseMove={handlers.onMouseMove}
          onMouseLeave={handlers.onMouseLeave}
          onFocus={(e) => {
            const indexAttr = (e.target as HTMLElement)
              .closest('[data-proximity-index]')
              ?.getAttribute('data-proximity-index')
            if (indexAttr != null) {
              const idx = Number(indexAttr)
              setActiveIndex(idx)
              setFocusedIndex((e.target as HTMLElement).matches(':focus-visible') ? idx : null)
            }
          }}
          onBlur={(e) => {
            if (containerRef.current?.contains(e.relatedTarget as Node)) return
            setFocusedIndex(null)
            setActiveIndex(null)
          }}
          onKeyDown={(e) => {
            const items = Array.from(
              containerRef.current?.querySelectorAll('[role="checkbox"]') ?? [],
            ) as HTMLElement[]
            const currentIdx = items.indexOf(e.target as HTMLElement)
            if (currentIdx === -1) return
            if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
              e.preventDefault()
              const next =
                e.key === 'ArrowDown'
                  ? (currentIdx + 1) % items.length
                  : (currentIdx - 1 + items.length) % items.length
              items[next]?.focus()
            } else if (e.key === 'Home') {
              e.preventDefault()
              items[0]?.focus()
            } else if (e.key === 'End') {
              e.preventDefault()
              items[items.length - 1]?.focus()
            }
          }}
          role="group"
          className={cn('relative flex w-72 max-w-full select-none flex-col gap-0.5', className)}
          {...props}
        >
          <AnimatePresence>
            {checkedGroups.map((group) => {
              const startRect = itemRects[group.start]
              const endRect = itemRects[group.end]
              if (!startRect || !endRect) return null
              const mergedTop = startRect.top
              const mergedHeight = endRect.top + endRect.height - startRect.top
              const mergedLeft = Math.min(startRect.left, endRect.left)
              const mergedWidth = Math.max(startRect.width, endRect.width)
              return (
                <motion.div
                  key={`group-${group.id}`}
                  className={cn(
                    'pointer-events-none absolute bg-muted/80',
                    shape.mergedBg,
                  )}
                  initial={false}
                  animate={{
                    top: mergedTop,
                    left: mergedLeft,
                    width: mergedWidth,
                    height: mergedHeight,
                    opacity: isHoveringOther ? 0.8 : 1,
                  }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ ...springs.moderate, opacity: { duration: 0.08 } }}
                />
              )
            })}
          </AnimatePresence>

          <AnimatePresence>
            {activeRect ? (
              <motion.div
                key={sessionRef.current}
                className={cn('pointer-events-none absolute bg-muted/60', shape.bg)}
                initial={{
                  opacity: 0,
                  top: activeRect.top,
                  left: activeRect.left,
                  width: activeRect.width,
                  height: activeRect.height,
                }}
                animate={{
                  opacity: 1,
                  top: activeRect.top,
                  left: activeRect.left,
                  width: activeRect.width,
                  height: activeRect.height,
                }}
                exit={{ opacity: 0, transition: { duration: 0.06 } }}
                transition={{ ...springs.fast, opacity: { duration: 0.08 } }}
              />
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {focusRect ? (
              <motion.div
                className={cn('pointer-events-none absolute z-20 border border-ring', shape.focusRing)}
                initial={false}
                animate={{
                  left: focusRect.left - 2,
                  top: focusRect.top - 2,
                  width: focusRect.width + 4,
                  height: focusRect.height + 4,
                }}
                exit={{ opacity: 0, transition: { duration: 0.06 } }}
                transition={{ ...springs.fast, opacity: { duration: 0.08 } }}
              />
            ) : null}
          </AnimatePresence>

          {children}
        </div>
      </CheckboxGroupContext.Provider>
    )
  },
)

CheckboxGroup.displayName = 'CheckboxGroup'

interface CheckboxItemProps extends HTMLAttributes<HTMLDivElement> {
  label: string
  index: number
  checked: boolean
  onToggle: () => void
}

const CheckboxItem = forwardRef<HTMLDivElement, CheckboxItemProps>(
  ({ label, index, checked, onToggle, className, ...props }, ref) => {
    const internalRef = useRef<HTMLDivElement>(null)
    const hasMounted = useRef(false)
    const { registerItem, activeIndex } = useCheckboxGroup()

    useEffect(() => {
      registerItem(index, internalRef.current)
      return () => registerItem(index, null)
    }, [index, registerItem])

    useEffect(() => {
      hasMounted.current = true
    }, [])

    const isActive = activeIndex === index
    const skipAnimation = !hasMounted.current

    return (
      <div
        ref={(node) => {
          internalRef.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        data-proximity-index={index}
        tabIndex={0}
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            onToggle()
          }
        }}
        className={cn(
          'relative z-10 flex cursor-pointer items-center gap-2.5 px-3 py-2 outline-none',
          shape.item,
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Root
          checked={checked}
          onCheckedChange={() => onToggle()}
          tabIndex={-1}
          aria-hidden
          className="relative h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none border-0 bg-transparent p-0 outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={cn(
              'absolute inset-0 rounded-[5px] border-solid transition-all duration-80',
              checked
                ? 'border-[1.5px] border-transparent'
                : isActive
                  ? 'border-[1.5px] border-muted-foreground'
                  : 'border-[1.5px] border-border',
            )}
          />
          <AnimatePresence>
            {checked ? (
              <CheckboxPrimitive.Indicator forceMount asChild>
                <motion.svg
                  width={18}
                  height={18}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="absolute inset-0 text-foreground"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 1 }}
                >
                  <motion.path
                    d="M6 12L10 16L18 8"
                    initial={{ pathLength: skipAnimation ? 1 : 0 }}
                    animate={{ pathLength: 1, transition: { duration: 0.08, ease: 'easeOut' } }}
                    exit={{ pathLength: 0, transition: { duration: 0.04, ease: 'easeIn' } }}
                  />
                </motion.svg>
              </CheckboxPrimitive.Indicator>
            ) : null}
          </AnimatePresence>
        </CheckboxPrimitive.Root>

        <span className="inline-grid text-[13px]">
          <span className="invisible col-start-1 row-start-1 font-semibold" aria-hidden="true">
            {label}
          </span>
          <span
            className={cn(
              'col-start-1 row-start-1 transition-[color,font-weight] duration-80',
              checked || isActive ? 'font-semibold text-foreground' : 'text-muted-foreground',
            )}
          >
            {label}
          </span>
        </span>
      </div>
    )
  },
)

CheckboxItem.displayName = 'CheckboxItem'

export { CheckboxGroup, CheckboxItem }
