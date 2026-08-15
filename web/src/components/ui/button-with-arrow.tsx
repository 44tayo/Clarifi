'use client'

import { ArrowRight } from 'lucide-react'
import * as React from 'react'

import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ButtonWithArrowProps = ButtonProps & {
  arrowClassName?: string
}

export const ButtonWithArrow = React.forwardRef<HTMLButtonElement, ButtonWithArrowProps>(
  ({ className, children, arrowClassName, ...props }, ref) => (
    <Button ref={ref} className={cn('group', className)} {...props}>
      {children}
      <ArrowRight
        className={cn(
          '-me-1 ms-2 opacity-60 transition-transform group-hover:translate-x-0.5',
          arrowClassName,
        )}
        size={16}
        strokeWidth={2}
        aria-hidden="true"
      />
    </Button>
  ),
)
ButtonWithArrow.displayName = 'ButtonWithArrow'
