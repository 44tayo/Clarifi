'use client'

import { useEffect, useState } from 'react'

import { AudioSessionWaveformButton } from '@/components/ui/audio-session-waveform'
import { cn } from '@/lib/utils'

interface AIVoiceInputProps {
  onStart?: () => void
  onStop?: (duration: number) => void
  visualizerBars?: number
  demoMode?: boolean
  demoInterval?: number
  className?: string
  variant?: 'default' | 'on-blue' | 'on-black'
}

export function AIVoiceInput({
  onStart,
  onStop,
  visualizerBars = 48,
  demoMode = false,
  demoInterval = 3000,
  className,
  variant = 'default',
}: AIVoiceInputProps) {
  const onDark = variant === 'on-blue' || variant === 'on-black'
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
        <AudioSessionWaveformButton
          active={submitted}
          onClick={handleClick}
          size="lg"
          variant={onDark ? 'on-dark' : 'default'}
          className="mb-1"
        />

        <span
          className={cn(
            'font-mono text-sm transition-opacity duration-300',
            onDark
              ? submitted
                ? 'text-white/70'
                : 'text-white/30'
              : submitted
                ? 'text-foreground'
                : 'text-muted-foreground/50',
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
                  ? onDark
                    ? 'animate-pulse bg-red-400/60'
                    : 'animate-pulse bg-red-500/50'
                  : onDark
                    ? 'h-1 bg-white/10'
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

        <p className={cn('h-4 text-xs', onDark ? 'text-white/70' : 'text-muted-foreground')}>
          {submitted ? 'Listening...' : 'Click to speak'}
        </p>
      </div>
    </div>
  )
}
