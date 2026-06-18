'use client'

import { BookOpen, Home, Tag } from 'lucide-react'

import { NavBar } from '@/components/ui/tubelight-navbar'

/** Standalone demo — fixed tubelight nav for previews. */
export function NavBarDemo() {
  const navItems = [
    { name: 'Home', url: '/', icon: Home },
    { name: 'Blog', url: '/blog', icon: BookOpen },
    { name: 'Pricing', url: '/pricing', icon: Tag },
  ]

  return <NavBar items={navItems} />
}
