'use client'

import { Mic } from 'lucide-react'
import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

interface AIVoiceInputProps {
  onStart?: () => void
  onStop?: (duration: number) => void
  visualizerBars?: number
  demoMode?: boolean
  demoInterval?: number
  className?: string
}

export function AIVoiceInput({
  onStart,
  onStop,
  visualizerBars = 48,
  demoMode = false,
  demoInterval = 3000,
  className,
}: AIVoiceInputProps) {
  const [submitted, setSubmitted] = useState(false)
  const [time, setTime] = useState(0)
  const [isClient, setIsClient] = useState(false)
  const [isDemo, setIsDemo] = useState(demoMode)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>

    if (submitted) {
      onStart?.()
      intervalId = setInterval(() => {
        setTime((t) => t + 1)
      }, 1000)
    } else {
      onStop?.(time)
      setTime(0)
    }

    return () => clearInterval(intervalId)
  }, [submitted, time, onStart, onStop])

  useEffect(() => {
    if (!isDemo) return

    let timeoutId: ReturnType<typeof setTimeout>
    const runAnimation = () => {
      setSubmitted(true)
      timeoutId = setTimeout(() => {
        setSubmitted(false)
        timeoutId = setTimeout(runAnimation, 1000)
      }, demoInterval)
    }

    const initialTimeout = setTimeout(runAnimation, 100)
    return () => {
      clearTimeout(timeoutId)
      clearTimeout(initialTimeout)
    }
  }, [isDemo, demoInterval])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleClick = () => {
    if (isDemo) {
      setIsDemo(false)
      setSubmitted(false)
    } else {
      setSubmitted((prev) => !prev)
    }
  }

  return (
    <div className={cn('w-full py-4', className)}>
      <div className="relative mx-auto flex w-full max-w-xl flex-col items-center gap-2">
        <button
          className={cn(
            'group flex h-16 w-16 items-center justify-center rounded-xl transition-colors',
            submitted ? 'bg-none' : 'bg-none hover:bg-accent',
          )}
          type="button"
          onClick={handleClick}
        >
          {submitted ? (
            <div
              className="pointer-events-auto h-6 w-6 cursor-pointer animate-spin rounded-sm bg-primary"
              style={{ animationDuration: '3s' }}
            />
          ) : (
            <Mic className="h-6 w-6 text-muted-foreground" />
          )}
        </button>

        <span
          className={cn(
            'font-mono text-sm transition-opacity duration-300',
            submitted ? 'text-foreground' : 'text-muted-foreground/50',
          )}
        >
          {formatTime(time)}
        </span>

        <div className="flex h-4 w-64 items-center justify-center gap-0.5">
          {[...Array(visualizerBars)].map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-0.5 rounded-full transition-all duration-300',
                submitted
                  ? 'animate-pulse bg-primary/50'
                  : 'h-1 bg-muted-foreground/20',
              )}
              style={
                submitted && isClient
                  ? {
                      height: `${20 + Math.random() * 80}%`,
                      animationDelay: `${i * 0.05}s`,
                    }
                  : undefined
              }
            />
          ))}
        </div>

        <p className="h-4 text-xs text-muted-foreground">
          {submitted ? 'Listening...' : 'Click to speak'}
        </p>
      </div>
    </div>
  )
}
