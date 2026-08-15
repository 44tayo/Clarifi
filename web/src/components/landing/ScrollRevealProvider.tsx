'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const REVEAL_ATTR = 'data-revealed'

const IO_OPTIONS: IntersectionObserverInit = {
  root: null,
  rootMargin: '0px 0px 12% 0px',
  threshold: 0,
}

function isInRevealZone(el: Element) {
  const rect = el.getBoundingClientRect()
  const vh = window.innerHeight
  return rect.top < vh * 0.95 && rect.bottom > vh * 0.02
}

function useScrollReveal(enabled: boolean) {
  const pathname = usePathname()

  useEffect(() => {
    if (!enabled) return

    let observer: IntersectionObserver | null = null
    let mutationObserver: MutationObserver | null = null
    const observed = new WeakSet<Element>()

    const markRevealed = (el: Element) => {
      if (el.hasAttribute(REVEAL_ATTR)) return
      el.setAttribute(REVEAL_ATTR, '')
      observer?.unobserve(el)
      observed.delete(el)
    }

    const revealInView = () => {
      document.querySelectorAll(`[data-reveal]:not([${REVEAL_ATTR}])`).forEach((el) => {
        if (isInRevealZone(el)) markRevealed(el)
      })
    }

    const watchElement = (el: Element) => {
      if (!observer || el.hasAttribute(REVEAL_ATTR) || observed.has(el)) return
      observed.add(el)
      observer.observe(el)
    }

    const watchTree = (root: Element | Document = document) => {
      if (!observer) return
      if (root instanceof Element) {
        if (root.hasAttribute('data-reveal')) watchElement(root)
        root.querySelectorAll(`[data-reveal]:not([${REVEAL_ATTR}])`).forEach(watchElement)
      } else {
        root.querySelectorAll(`[data-reveal]:not([${REVEAL_ATTR}])`).forEach(watchElement)
      }
    }

    document.querySelectorAll(`[data-reveal][${REVEAL_ATTR}]`).forEach((el) => {
      el.removeAttribute(REVEAL_ATTR)
    })

    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) markRevealed(entry.target)
      })
    }, IO_OPTIONS)

    revealInView()
    watchTree()

    mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) watchTree(node)
        })
      }
    })
    mutationObserver.observe(document.body, { childList: true, subtree: true })

    const onResize = () => revealInView()
    window.addEventListener('resize', onResize, { passive: true })

    return () => {
      observer?.disconnect()
      mutationObserver?.disconnect()
      window.removeEventListener('resize', onResize)
      document.querySelectorAll(`[data-reveal][${REVEAL_ATTR}]`).forEach((el) => {
        el.removeAttribute(REVEAL_ATTR)
      })
    }
  }, [enabled, pathname])
}

export function ScrollRevealProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [active, setActive] = useState(false)

  useEffect(() => {
    setActive(false)
    const timer = window.setTimeout(() => setActive(true), 100)
    return () => window.clearTimeout(timer)
  }, [pathname])

  useScrollReveal(active)

  return (
    <div data-reveal-root={active ? '' : undefined} style={{ display: 'contents' }}>
      {children}
    </div>
  )
}
