'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import React, { useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type DropdownMenuOption = {
  label: string
  onClick: () => void
  Icon?: React.ReactNode
}

export type DropdownMenuProps = {
  options: DropdownMenuOption[]
  children: React.ReactNode
  variant?: 'light' | 'dark'
  className?: string
}

/**
 * Action dropdown menu (21st.dev / chetanverma16 style).
 * For single-value pickers, use DropdownSelect.
 */
export function DropdownMenu({
  options,
  children,
  variant = 'light',
  className,
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  const triggerClass =
    variant === 'dark'
      ? 'bg-slate-900/60 hover:bg-slate-900/80 border-slate-600/30 text-slate-50'
      : 'bg-[var(--ds-bg-app,#f7f8fc)] hover:bg-[var(--ds-bg-muted,#f1f4fa)] border-[var(--ds-border-strong,#d8e0ef)] text-slate-900'

  return (
    <div className={cn('relative', className)}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          'w-full justify-between rounded-lg border px-3 py-2.5 text-sm font-medium shadow-sm shadow-black/5 backdrop-blur-sm',
          triggerClass,
        )}
      >
        {children ?? 'Menu'}
        <motion.span
          className="ml-2"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
        >
          <ChevronDown className="h-4 w-4 opacity-70" />
        </motion.span>
      </Button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ y: -5, scale: 0.95, opacity: 0, filter: 'blur(6px)' }}
            animate={{ y: 0, scale: 1, opacity: 1, filter: 'blur(0px)' }}
            exit={{ y: -5, scale: 0.95, opacity: 0, filter: 'blur(6px)' }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="absolute z-50 mt-2 w-full min-w-[12rem] overflow-hidden rounded-xl border border-white/10 bg-[#111111]/95 p-1 shadow-[0_16px_40px_rgba(15,23,42,0.35)] backdrop-blur-md"
          >
            {options.length > 0 ? (
              options.map((option, index) => (
                <motion.button
                  key={option.label}
                  type="button"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.18, delay: index * 0.04 }}
                  whileHover={{ backgroundColor: 'rgba(43, 108, 255, 0.35)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    option.onClick()
                    setIsOpen(false)
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-slate-50"
                >
                  {option.Icon}
                  {option.label}
                </motion.button>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-slate-400">No options</div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export default DropdownMenu
