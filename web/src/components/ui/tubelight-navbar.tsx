'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface NavItem {
  name: string
  url: string
  icon: LucideIcon
}

export interface NavBarProps {
  items: NavItem[]
  className?: string
  /** Pin to viewport (top on desktop, bottom on mobile). Default `true`. */
  fixed?: boolean
  /** Override auto-detected active tab. */
  activeName?: string
}

function matchPath(pathname: string, url: string) {
  if (url === '/') return pathname === '/'
  return pathname === url || pathname.startsWith(`${url}/`)
}

export function NavBar({ items, className, fixed = true, activeName }: NavBarProps) {
  const pathname = usePathname()
  const [activeTab, setActiveTab] = useState(items[0]?.name ?? '')

  useEffect(() => {
    if (activeName) {
      setActiveTab(activeName)
      return
    }
    const match = items.find((item) => matchPath(pathname, item.url))
    if (match) setActiveTab(match.name)
  }, [activeName, items, pathname])

  if (items.length === 0) return null

  return (
    <div
      className={cn(
        fixed && 'fixed bottom-0 left-1/2 z-50 mb-6 -translate-x-1/2 sm:top-0 sm:pt-6',
        className,
      )}
    >
      <div className="flex items-center gap-1 rounded-full border border-border bg-background/80 px-1 py-1 shadow-lg backdrop-blur-lg sm:gap-3">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.name

          return (
            <Link
              key={item.name}
              href={item.url}
              onClick={() => setActiveTab(item.name)}
              className={cn(
                'relative cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors sm:px-6',
                'text-foreground/80 hover:text-primary',
                isActive && 'text-primary',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="hidden md:inline">{item.name}</span>
              <span className="md:hidden" aria-hidden={!isActive}>
                <Icon size={18} strokeWidth={2.5} />
              </span>
              <span className="sr-only md:hidden">{item.name}</span>
              {isActive && (
                <motion.div
                  layoutId="tubelight-lamp"
                  className="absolute inset-0 -z-10 w-full rounded-full bg-primary/5"
                  initial={false}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 30,
                  }}
                >
                  <div className="absolute -top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-t-full bg-primary">
                    <div className="absolute -left-2 -top-2 h-6 w-12 rounded-full bg-primary/20 blur-md" />
                    <div className="absolute -top-1 h-6 w-8 rounded-full bg-primary/20 blur-md" />
                    <div className="absolute left-2 top-0 h-4 w-4 rounded-full bg-primary/20 blur-sm" />
                  </div>
                </motion.div>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
