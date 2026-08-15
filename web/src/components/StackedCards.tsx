'use client'

import Image from 'next/image'
import { useState } from 'react'

import { MacBookMock } from '@/components/landing/MacBookMock'
import { cn } from '@/lib/utils'

import '@/components/landing/stacked-cards-mocks.css'

type StackedCard = {
  id: string
  variant: 'background' | 'no-bots'
  heading: string
  body: string
}

const WALLPAPER = '/images/hero-lake-sky.png'

const CALL_TILES = [
  {
    name: 'Maya',
    image:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=240&q=60',
  },
  {
    name: 'Alex',
    image:
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=240&q=60',
  },
  {
    name: 'Jordan',
    image:
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=240&q=60',
  },
  {
    name: 'Sam',
    image:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=240&q=60',
  },
  {
    name: 'Riley',
    image:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=240&q=60',
  },
  {
    name: 'You',
    image:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=240&q=60',
  },
] as const

const cards: StackedCard[] = [
  {
    id: 'card-background',
    variant: 'background',
    heading: 'Clarifi in the background',
    body: 'Hit record and stay in the conversation. Clarifi listens quietly on your Mac while you jot a note or two—then turns the call into notes you can trust.',
  },
  {
    id: 'card-no-bots',
    variant: 'no-bots',
    heading: 'No bots in your calls',
    body: 'Your meeting stays a meeting. Clarifi never joins Zoom, Meet, or Teams as a guest—just a notepad on your desktop, capturing what matters.',
  },
]

function BackgroundMock() {
  return (
    <div className="sc-bg-stage" aria-hidden>
      <Image
        src="/images/clarifi-widget-bg-exact.png"
        alt=""
        fill
        className="sc-bg-scene-img"
        sizes="(max-width: 768px) 90vw, 520px"
        priority={false}
      />
      <div className="sc-bg-widget">
        <span className="sc-bg-widget-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/clarifi-logo.png" alt="" width={36} height={36} />
        </span>
        <span className="sc-bg-widget-wave">
          {Array.from({ length: 7 }).map((_, i) => (
            <i key={i} />
          ))}
        </span>
        <span className="sc-bg-widget-pause" />
      </div>
    </div>
  )
}

function NoBotsMock() {
  return (
    <div className="sc-nobots" aria-hidden>
      <MacBookMock size="lg">
        <div
          className="sc-desktop"
          style={{ backgroundImage: `url(${WALLPAPER})` }}
        >
          <div className="sc-notes">
            <div className="sc-notes-chrome">
              <div className="sc-notes-traffic">
                <span />
                <span />
                <span />
              </div>
              <span className="sc-notes-nav" />
              <span className="sc-notes-menu" />
            </div>
            <div className="sc-notes-body">
              <h3 className="sc-notes-title">Team Stand-up</h3>
              <span className="sc-notes-meta">Today · 6</span>
              <p className="sc-notes-placeholder">Write notes</p>
            </div>
          </div>

          <div className="sc-call">
            <div className="sc-call-grid">
              {CALL_TILES.map((tile) => (
                <div
                  key={tile.name}
                  className="sc-call-tile"
                  style={{ backgroundImage: `url(${tile.image})` }}
                >
                  <span>{tile.name}</span>
                </div>
              ))}
            </div>
            <div className="sc-call-controls">
              <span className="sc-call-btn" />
              <span className="sc-call-btn" />
              <span className="sc-call-btn sc-call-btn--end" />
            </div>
          </div>
        </div>
      </MacBookMock>
    </div>
  )
}

function CardContent({ card }: { card: StackedCard }) {
  if (card.variant === 'no-bots') return <NoBotsMock />
  return <BackgroundMock />
}

export function StackedCards() {
  const [activeId, setActiveId] = useState(cards[0].id)
  const activeCard = cards.find((card) => card.id === activeId) ?? cards[0]

  const showCard = (id: string) => setActiveId(id)

  return (
    <section className="relative overflow-visible bg-white py-24 md:py-32">
      <div className="container relative z-10 mx-auto w-full max-w-[1220px] px-6 md:px-10">
        <div className="grid grid-cols-1 items-center gap-16 md:grid-cols-2 md:gap-8">
          <div className="mx-auto flex max-w-[546px] flex-col items-start gap-4 md:mx-0">
            <div
              key={activeId}
              className="flex flex-col gap-4 animate-in fade-in duration-500 ease-in-out"
            >
              <h2 className="text-4xl leading-tight font-bold tracking-tight text-[var(--ds-navy)] md:text-5xl md:leading-[1.1]">
                {activeCard.heading}
              </h2>
              <p className="text-base leading-relaxed text-[var(--ds-muted)] md:text-lg">
                {activeCard.body}
              </p>
            </div>
            <div className="mt-1 flex items-center gap-2" role="tablist" aria-label="Feature previews">
              {cards.map((card) => {
                const selected = card.id === activeId
                return (
                  <button
                    key={card.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    className={cn(
                      'h-2.5 rounded-full transition-all duration-300',
                      selected
                        ? 'w-9 bg-[var(--ds-blue)]'
                        : 'w-2.5 bg-[var(--ds-border)] hover:bg-[var(--ds-muted)]',
                    )}
                    onClick={() => showCard(card.id)}
                    aria-label={card.heading}
                  />
                )
              })}
            </div>
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-[440px] overflow-visible pb-[8%] pr-[8%] md:max-w-[440px] md:h-[420px] md:aspect-auto">
            {cards.map((card) => {
              const isActive = card.id === activeId

              return (
                <div
                  key={card.id}
                  role={isActive ? undefined : 'button'}
                  tabIndex={isActive ? undefined : 0}
                  className={cn(
                    'absolute inset-0 overflow-hidden rounded-3xl shadow-[0_8px_40px_rgba(26,26,46,0.1)] transition-all duration-500 ease-in-out',
                    isActive
                      ? 'pointer-events-none z-20 translate-x-0 translate-y-0 scale-100 opacity-100'
                      : 'z-10 cursor-pointer translate-x-[16%] translate-y-[16%] scale-95 opacity-95',
                  )}
                  aria-hidden={isActive ? true : undefined}
                  aria-label={isActive ? undefined : `Show ${card.heading}`}
                  onClick={isActive ? undefined : () => showCard(card.id)}
                  onKeyDown={
                    isActive
                      ? undefined
                      : (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            showCard(card.id)
                          }
                        }
                  }
                >
                  <CardContent card={card} />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
