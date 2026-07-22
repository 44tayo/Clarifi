import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type DropdownSelectOption = {
  value: string
  label: string
}

type DropdownSelectProps = {
  value: string
  options: DropdownSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  variant?: 'light' | 'dark'
  disabled?: boolean
  'aria-label'?: string
}

type MenuPosition = {
  top: number
  left: number
  width: number
}

function ChevronDownIcon() {
  return (
    <svg
      className="ds-dropdown-select-chevron"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function DropdownSelect({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  className = '',
  variant = 'light',
  disabled = false,
  'aria-label': ariaLabel,
}: DropdownSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  const selected = options.find((option) => option.value === value)
  const displayLabel = selected?.label ?? placeholder

  const close = useCallback(() => {
    setIsOpen(false)
    setHighlightIndex(-1)
    setMenuPosition(null)
  }, [])

  const updateMenuPosition = useCallback(() => {
    const trigger = rootRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const gap = 6
    const maxHeight = 240
    const estimatedHeight = Math.min(maxHeight, Math.max(48, options.length * 44 + 16))
    const spaceBelow = window.innerHeight - rect.bottom - gap - 8
    const openUpward = spaceBelow < estimatedHeight && rect.top > spaceBelow

    setMenuPosition({
      top: openUpward
        ? Math.max(8, rect.top - gap - estimatedHeight)
        : rect.bottom + gap,
      left: rect.left,
      width: rect.width,
    })
  }, [options.length])

  useLayoutEffect(() => {
    if (!isOpen) return
    updateMenuPosition()
  }, [isOpen, updateMenuPosition])

  useEffect(() => {
    if (!isOpen) return

    const onOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const onReposition = () => updateMenuPosition()

    const outsideClickTimer = window.setTimeout(() => {
      document.addEventListener('mousedown', onOutsideClick)
    }, 0)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)

    return () => {
      window.clearTimeout(outsideClickTimer)
      document.removeEventListener('mousedown', onOutsideClick)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [close, isOpen, updateMenuPosition])

  const selectOption = (optionValue: string) => {
    onChange(optionValue)
    close()
  }

  const rootClass = [
    'ds-dropdown-select',
    isOpen ? 'is-open' : '',
    variant === 'dark' ? 'ds-dropdown-select--dark' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const menu = isOpen && menuPosition
    ? createPortal(
        <ul
          ref={menuRef}
          className={`ds-dropdown-select-menu ds-dropdown-select-menu--portal${
            variant === 'dark' ? ' ds-dropdown-select-menu--dark' : ''
          }`}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
          }}
        >
          {options.length === 0 ? (
            <li className="ds-dropdown-select-empty" role="presentation">
              No options
            </li>
          ) : (
            options.map((option, index) => {
              const isSelected = option.value === value
              const isHighlighted = index === highlightIndex
              return (
                <li key={option.value || `option-${index}`} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`ds-dropdown-select-option${isSelected ? ' is-selected' : ''}${
                      isHighlighted ? ' is-highlighted' : ''
                    }`}
                    onMouseEnter={() => setHighlightIndex(index)}
                    onMouseDown={(event) => {
                      // Prefer mousedown so selection wins before any outside-close handlers.
                      event.preventDefault()
                      event.stopPropagation()
                      selectOption(option.value)
                    }}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                    }}
                  >
                    <span className="ds-dropdown-select-check" aria-hidden="true">
                      {isSelected ? '✓' : ''}
                    </span>
                    <span className="ds-dropdown-select-option-label">{option.label}</span>
                  </button>
                </li>
              )
            })
          )}
        </ul>,
        document.body,
      )
    : null

  return (
    <div className={rootClass} ref={rootRef}>
      <button
        type="button"
        className={`ds-dropdown-select-trigger${isOpen ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation()
          if (disabled) return
          setIsOpen((open) => !open)
        }}
        onKeyDown={(event) => {
          if (disabled) return
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setIsOpen(true)
            setHighlightIndex(Math.max(0, options.findIndex((o) => o.value === value)))
          }
        }}
      >
        <span className="ds-dropdown-select-trigger-label">{displayLabel}</span>
        <ChevronDownIcon />
      </button>
      {menu}
    </div>
  )
}
