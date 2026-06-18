'use client'

import React from 'react'
import { MenuIcon } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import { Sheet, SheetContent, SheetFooter } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export type FloatingHeaderLink = {
  label: string
  href: string
  active?: boolean
}

export type FloatingHeaderProps = {
  links?: FloatingHeaderLink[]
  logo?: React.ReactNode
  actions?: React.ReactNode
  mobileActions?: React.ReactNode
}

const DEFAULT_LINKS: FloatingHeaderLink[] = [
  { label: 'Features', href: '#' },
  { label: 'Pricing', href: '#' },
  { label: 'About', href: '#' },
]

export function FloatingHeader({
  links = DEFAULT_LINKS,
  logo,
  actions,
  mobileActions,
}: FloatingHeaderProps) {
  const [open, setOpen] = React.useState(false)

  const desktopActions =
    actions ?? (
      <>
        <Button size="sm" variant="secondary">
          Login
        </Button>
      </>
    )

  const sheetActions =
    mobileActions ??
    actions ?? (
      <>
        <Button variant="outline">Sign In</Button>
        <Button>Get Started</Button>
      </>
    )

  return (
    <header
      className={cn(
        'z-50 mx-auto w-full max-w-6xl rounded-2xl border border-white/40 shadow-lg',
        'bg-white/30 backdrop-blur-2xl backdrop-saturate-150',
        'dark:border-white/10 dark:bg-zinc-950/40',
      )}
    >
      <nav className="relative mx-auto flex min-h-14 items-center justify-between px-5 py-2.5">
        <div className="min-w-0 shrink-0">
          {logo ?? (
            <div className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 duration-100 hover:bg-accent">
              <p className="font-mono text-base font-bold">Clarifi</p>
            </div>
          )}
        </div>

        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex">
          {links.map((link) => (
            <a
              key={link.label}
              className={buttonVariants({
                variant: link.active ? 'secondary' : 'ghost',
                size: 'default',
              })}
              href={link.href}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="relative ml-auto flex items-center gap-2.5">
          <div className="hidden items-center gap-2.5 lg:flex">{desktopActions}</div>
          <Sheet open={open} onOpenChange={setOpen}>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setOpen(!open)}
              className="lg:hidden"
              aria-label="Open menu"
            >
              <MenuIcon className="size-4" />
            </Button>
            <SheetContent
              className="gap-0 bg-background/95 backdrop-blur-lg supports-[backdrop-filter]:bg-background/80"
              showClose={false}
              side="left"
            >
              <div className="grid gap-y-2 overflow-y-auto px-4 pt-12 pb-5">
                {links.map((link) => (
                  <a
                    key={link.label}
                    className={buttonVariants({
                      variant: link.active ? 'secondary' : 'ghost',
                      className: 'justify-start',
                    })}
                    href={link.href}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
              <SheetFooter onClick={() => setOpen(false)}>{sheetActions}</SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  )
}
