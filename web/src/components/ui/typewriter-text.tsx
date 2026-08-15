'use client'

import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

type TypewriterProps = {
  /** Single string or rotating list of strings (HextaUI / 21st.dev API). */
  text: string | string[]
  /** Delay between characters in ms. */
  speed?: number
  /** When true, cycles through `text` forever. */
  loop?: boolean
  className?: string
  cursorClassName?: string
  /** Fires once when a non-looping run finishes the last string. */
  onComplete?: () => void
  /** Pause typing without unmounting. Defaults to true. */
  active?: boolean
}

/**
 * Typewriter text — API aligned with
 * `npx shadcn@latest add "https://21st.dev/r/preetsuthar17/typewriter-text"`.
 *
 * Single timer loop (refs + one effect) so Strict Mode / parent re-renders
 * cannot cancel typing mid-character via a reset/type effect race.
 */
export function Typewriter({
  text,
  speed = 50,
  loop = true,
  className,
  cursorClassName,
  onComplete,
  active = true,
}: TypewriterProps) {
  const lines = Array.isArray(text) ? text : [text]
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const scriptKey = `${loop}:${speed}:${lines.join('\0')}`

  useEffect(() => {
    setDisplayed('')
    setDone(false)

    if (!active || lines.length === 0) return

    let lineIndex = 0
    let charIndex = 0
    let completed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const runId = { current: true }

    const clear = () => {
      if (timer !== undefined) {
        clearTimeout(timer)
        timer = undefined
      }
    }

    const schedule = (fn: () => void, delay: number) => {
      clear()
      timer = setTimeout(() => {
        timer = undefined
        if (!runId.current) return
        fn()
      }, delay)
    }

    const tick = () => {
      if (!runId.current) return

      const line = lines[lineIndex] ?? ''
      if (charIndex < line.length) {
        charIndex += 1
        setDisplayed(line.slice(0, charIndex))
        schedule(tick, speed)
        return
      }

      if (loop) {
        schedule(() => {
          lineIndex = (lineIndex + 1) % lines.length
          charIndex = 0
          setDisplayed('')
          schedule(tick, speed)
        }, 900)
        return
      }

      if (lineIndex < lines.length - 1) {
        schedule(() => {
          lineIndex += 1
          charIndex = 0
          setDisplayed('')
          schedule(tick, speed)
        }, 400)
        return
      }

      setDone(true)
      if (!completed) {
        completed = true
        onCompleteRef.current?.()
      }
    }

    schedule(tick, speed)

    return () => {
      runId.current = false
      clear()
    }
    // lines derived from scriptKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptKey, active])

  return (
    <span className={cn('inline whitespace-pre-wrap', className)}>
      {displayed}
      {!done || loop ? (
        <span
          className={cn(
            'ml-px inline-block h-[1em] w-[2px] translate-y-[0.1em] bg-current align-baseline',
            cursorClassName,
          )}
          aria-hidden
        />
      ) : null}
    </span>
  )
}
