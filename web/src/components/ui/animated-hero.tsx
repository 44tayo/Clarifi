'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MoveRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { KineticTextReveal } from '@/components/ui/kinetic-text-reveal'
import { cn } from '@/lib/utils'

export type AnimatedHeroProps = {
  /** Static lead-in before the rotating word (legacy layout). */
  lead?: string
  /** First headline line (Clarifi layout). */
  title?: string
  /** Prefix before the rotating word, e.g. "For Every". */
  accentPrefix?: string
  /** Words that cycle in the headline. */
  words: string[]
  description: string
  /** Optional link shown as a secondary pill above the headline. */
  eyebrow?: { label: string; href: string }
  actions?: ReactNode
  className?: string
}

export function AnimatedHero({
  lead,
  title,
  accentPrefix,
  words,
  description,
  eyebrow,
  actions,
  className,
}: AnimatedHeroProps) {
  const titles = useMemo(() => words, [words.join('\0')])
  const [titleNumber, setTitleNumber] = useState(0)
  const clarifiLayout = Boolean(title && accentPrefix)

  useEffect(() => {
    if (titles.length <= 1) return

    const intervalId = setInterval(() => {
      setTitleNumber((current) => (current === titles.length - 1 ? 0 : current + 1))
    }, 4500)

    return () => clearInterval(intervalId)
  }, [titles.length, titles.join('\0')])

  const currentWord = titles[titleNumber] ?? titles[0]

  const rotatingWords = (
    <span
      className={cn(
        'relative inline-grid h-[1.1em] overflow-hidden align-baseline leading-[inherit] hero-rotating-word',
        clarifiLayout ? '' : 'w-full',
      )}
      style={{ gridTemplateAreas: '"word"' }}
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={currentWord}
          style={{ gridArea: 'word' }}
          className="inline align-baseline bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 bg-clip-text font-bold capitalize leading-[inherit] text-transparent"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
        >
          {currentWord}
        </motion.span>
      </AnimatePresence>
    </span>
  )

  return (
    <div className={cn('w-full', className)}>
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex flex-col items-center justify-center gap-6 py-4 md:py-6">
          {eyebrow ? (
            <Button variant="secondary" size="sm" className="gap-2" asChild>
              <Link href={eyebrow.href}>
                {eyebrow.label}
                <MoveRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          ) : null}

          <div className="flex flex-col gap-4">
            <h1
              className={cn(
                'max-w-3xl text-center tracking-tight text-[var(--cl-navy,#1a1a2e)]',
                clarifiLayout
                  ? 'marketing-hero-title'
                  : 'text-4xl font-semibold md:text-6xl md:leading-[1.08]',
              )}
            >
              {clarifiLayout ? (
                <>
                  <span className="block">
                    <KineticTextReveal
                      text={title!}
                      className="justify-center"
                      splitBy="words"
                      direction="up"
                      distance={28}
                      stagger={0.08}
                    />
                  </span>
                  <span className="mt-1 inline-flex flex-wrap items-baseline justify-center gap-x-[0.25em] whitespace-nowrap leading-[1.15] md:mt-2">
                    <KineticTextReveal
                      text={accentPrefix!}
                      className="text-[var(--cl-navy,#1a1a2e)]"
                      splitBy="words"
                      direction="up"
                      distance={20}
                      stagger={0.06}
                      delay={0.18}
                    />
                    {rotatingWords}
                  </span>
                </>
              ) : (
                <>
                  <span className="block">
                    {lead ? (
                      <KineticTextReveal
                        text={lead}
                        className="justify-center"
                        splitBy="words"
                        direction="up"
                      />
                    ) : null}
                  </span>
                  <span className="relative mt-1 flex md:mt-2">{rotatingWords}</span>
                </>
              )}
            </h1>

            <p className="mx-auto max-w-2xl text-center text-base leading-relaxed tracking-tight text-muted-foreground md:text-lg">
              <KineticTextReveal
                text={description}
                className="justify-center"
                splitBy="words"
                direction="up"
                distance={16}
                stagger={0.02}
                delay={0.35}
                blur={false}
              />
            </p>
          </div>

          {actions ? (
            <div className="flex flex-row flex-wrap items-center justify-center gap-3">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** @deprecated Use named export `AnimatedHero`. */
export const Hero = AnimatedHero
