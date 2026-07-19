'use client'

import { useState } from 'react'

import { ClarifiAssistPreview } from '@/components/landing/ClarifiAssistPreview'
import { AIVoiceInput } from '@/components/ui/ai-voice-input'
import { AudioSessionWaveformButton } from '@/components/ui/audio-session-waveform'
import { cn } from '@/lib/utils'

type StackedCard =
  | {
      id: string
      variant: 'assist-preview'
      heading: string
      body: string
    }
  | {
      id: string
      variant: 'voice'
      heading: string
      body: string
    }

const cards: StackedCard[] = [
  {
    id: 'card-1',
    variant: 'voice',
    heading: 'Clarifi in meetings',
    body: 'Start recording, jot a few words, and stay in the conversation. Clarifi listens in the background and turns the call into notes you can trust.',
  },
  {
    id: 'card-2',
    variant: 'assist-preview',
    heading: 'Hang up. Notes ready.',
    body: 'When the meeting ends, Clarifi delivers a clean summary, decisions, and action items — plus your scratchpad and transcript.',
  },
]

function VoiceCardPreview() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-black px-6 py-8">
      <AudioSessionWaveformButton
        active={false}
        disabled
        size="lg"
        variant="on-dark"
        className="mb-3"
      />
      <span className="font-mono text-sm text-white/30">00:00</span>
      <div className="mt-3 flex h-4 w-64 items-center justify-center gap-0.5">
        {Array.from({ length: 48 }).map((_, i) => (
          <div key={i} className="h-1 w-0.5 rounded-full bg-white/10" />
        ))}
      </div>
      <p className="mt-3 text-xs text-white/70">Click to speak</p>
    </div>
  )
}

function CardContent({ card, isActive }: { card: StackedCard; isActive: boolean }) {
  if (card.variant === 'assist-preview') {
    return (
      <div className="flex h-full w-full items-center justify-center p-5 md:p-7">
        <ClarifiAssistPreview className="h-auto w-full max-w-[88%] max-h-[90%]" />
      </div>
    )
  }

  if (isActive) {
    return (
      <div className="pointer-events-auto flex h-full w-full flex-col items-center justify-center bg-black px-4 py-6">
        <AIVoiceInput variant="on-black" className="py-0" visualizerBars={48} />
      </div>
    )
  }

  return <VoiceCardPreview />
}

export function StackedCards() {
  // Tracks which card is visually in front of the image stack and drives the left-side copy.
  const [activeId, setActiveId] = useState(cards[0].id)

  const activeCard = cards.find((card) => card.id === activeId) ?? cards[0]

  return (
    <section className="relative overflow-hidden bg-white py-24 md:py-32">
      <div className="container relative z-10 mx-auto w-full max-w-[1220px] px-6 md:px-10">
        <div className="grid grid-cols-1 items-center gap-16 md:grid-cols-2 md:gap-8">
          <div
            key={activeId}
            className="mx-auto flex max-w-[546px] flex-col items-start gap-4 md:mx-0 animate-in fade-in duration-500 ease-in-out"
          >
            <h2 className="text-4xl leading-tight font-bold tracking-tight text-[var(--ds-navy)] md:text-5xl md:leading-[1.1]">
              {activeCard.heading}
            </h2>
            <p className="text-base leading-relaxed text-[var(--ds-muted)] md:text-lg">
              {activeCard.body}
            </p>
          </div>

          {/* div wrappers avoid nesting buttons when the voice card mic is interactive */}
          <div className="relative mx-auto aspect-square w-full max-w-[520px] md:max-w-none md:h-[500px] md:aspect-auto">
            {cards.map((card) => {
              const isActive = card.id === activeId

              return (
                <div
                  key={card.id}
                  role={isActive ? undefined : 'button'}
                  tabIndex={isActive ? -1 : 0}
                  className={cn(
                    'absolute inset-0 overflow-hidden transition-all duration-500 ease-in-out',
                    card.variant === 'assist-preview'
                      ? 'rounded-3xl bg-[var(--ds-lavender)] shadow-[0_8px_40px_rgba(26,26,46,0.1)]'
                      : 'rounded-2xl border border-[var(--ds-border)] shadow-[0_8px_40px_rgba(26,26,46,0.08)]',
                    isActive
                      ? 'pointer-events-none z-20 translate-x-0 translate-y-0 scale-100 opacity-100'
                      : 'z-10 translate-x-[16%] translate-y-[16%] scale-95 cursor-pointer opacity-90 hover:scale-100 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-blue)] focus-visible:ring-offset-2',
                    card.variant === 'voice' && isActive && 'border-black',
                  )}
                  onClick={isActive ? undefined : () => setActiveId(card.id)}
                  onKeyDown={
                    isActive
                      ? undefined
                      : (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setActiveId(card.id)
                          }
                        }
                  }
                  aria-label={isActive ? undefined : `Show ${card.heading}`}
                  aria-hidden={isActive}
                >
                  <CardContent card={card} isActive={isActive} />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
