'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

export type DropdownSelectOption = {
  value: string
  label: string
}

export type DropdownSelectProps = {
  value: string
  options: DropdownSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  variant?: 'light' | 'dark'
  disabled?: boolean
  'aria-label'?: string
}

/**
 * Single-value dropdown select (21st.dev / chetanverma16 visual style).
 */
export function DropdownSelect({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  className,
  variant = 'light',
  disabled = false,
  'aria-label': ariaLabel,
}: DropdownSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const selected = options.find((option) => option.value === value)
  const displayLabel = selected?.label ?? placeholder

  const close = useCallback(() => setIsOpen(false), [])

  useEffect(() => {
    if (!isOpen) return
    const onOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('click', onOutsideClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('click', onOutsideClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [close, isOpen])

  const triggerClass =
    variant === 'dark'
      ? 'border-slate-600/30 bg-slate-900/60 text-slate-50 hover:border-blue-500/60'
      : 'border-[var(--ds-border-strong,#d8e0ef)] bg-[var(--ds-bg-app,#f7f8fc)] text-slate-900 hover:border-[var(--ds-accent,#2b6cff)]'

  const menuClass =
    variant === 'dark'
      ? 'border-white/10 bg-[#111111]/95 shadow-[0_16px_40px_rgba(15,23,42,0.35)] backdrop-blur-md'
      : 'border-[var(--ds-border-strong,#d8e0ef)] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.12)]'

  const optionClass =
    variant === 'dark'
      ? 'text-slate-50 hover:bg-[rgba(43,108,255,0.35)]'
      : 'text-slate-900 hover:bg-[rgba(43,108,255,0.1)]'

  const selectedOptionClass =
    variant === 'dark' ? 'bg-[rgba(43,108,255,0.2)]' : 'bg-[rgba(43,108,255,0.12)]'

  const checkClass = variant === 'dark' ? 'text-blue-300' : 'text-[var(--ds-accent,#2b6cff)]'

  return (
    <div
      className={cn('relative w-full', isOpen && 'z-10', className)}
      ref={rootRef}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setIsOpen((open) => !open)
        }}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-medium shadow-sm shadow-black/5 transition-[border-color,box-shadow]',
          triggerClass,
          isOpen && 'border-[var(--ds-accent,#2b6cff)] ring-[3px] ring-[rgba(43,108,255,0.12)]',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span className="min-w-0 flex-1 truncate">{displayLabel}</span>
        <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.ul
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            initial={{ y: -4, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -4, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={cn(
              'absolute z-50 mt-1.5 max-h-60 w-full overflow-y-auto rounded-xl border p-1',
              menuClass,
            )}
          >
            {options.length === 0 ? (
              <li className="px-3 py-2 text-xs text-slate-400">No options</li>
            ) : (
              options.map((option) => {
                const isSelected = option.value === value
                return (
                  <li key={option.value || option.label} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(option.value)
                        close()
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                        optionClass,
                        isSelected && selectedOptionClass,
                      )}
                    >
                      <Check
                        className={cn('h-3.5 w-3.5 shrink-0', checkClass, !isSelected && 'invisible')}
                      />
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    </button>
                  </li>
                )
              })
            )}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export default DropdownSelect
