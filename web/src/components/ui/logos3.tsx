'use client'

import { useEffect, useMemo, useState } from 'react'
import AutoScroll from 'embla-carousel-auto-scroll'

import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel'
import { cn } from '@/lib/utils'

interface Logo {
  id: string
  description: string
  image: string
  className?: string
}

interface Logos3Props {
  heading?: string
  logos?: Logo[]
  className?: string
  headingClassName?: string
  containerClassName?: string
  grayscale?: boolean
  speed?: number
  strip?: boolean
}

const DEFAULT_LOGOS: Logo[] = [
  {
    id: 'logo-1',
    description: 'Astro',
    image: 'https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/astro-wordmark.svg',
    className: 'h-6 w-auto',
  },
  {
    id: 'logo-2',
    description: 'Figma',
    image: 'https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/figma-wordmark.svg',
    className: 'h-6 w-auto',
  },
  {
    id: 'logo-3',
    description: 'Next.js',
    image: 'https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/nextjs-wordmark.svg',
    className: 'h-6 w-auto',
  },
  {
    id: 'logo-4',
    description: 'React',
    image: 'https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/react-wordmark.svg',
    className: 'h-6 w-auto',
  },
  {
    id: 'logo-5',
    description: 'shadcn/ui',
    image: 'https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/shadcn-ui-wordmark.svg',
    className: 'h-6 w-auto',
  },
  {
    id: 'logo-6',
    description: 'Supabase',
    image: 'https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/supabase-wordmark.svg',
    className: 'h-6 w-auto',
  },
  {
    id: 'logo-7',
    description: 'Tailwind CSS',
    image: 'https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/tailwind-wordmark.svg',
    className: 'h-5 w-auto',
  },
  {
    id: 'logo-8',
    description: 'Vercel',
    image: 'https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/vercel-wordmark.svg',
    className: 'h-6 w-auto',
  },
]

export function Logos3({
  heading = 'Trusted by professionals',
  logos = DEFAULT_LOGOS,
  className,
  headingClassName,
  grayscale = true,
  speed = 0.75,
  containerClassName,
  strip = false,
}: Logos3Props) {
  const items = logos.length < 8 ? [...logos, ...logos, ...logos] : logos
  const [api, setApi] = useState<CarouselApi>()
  const autoScrollPlugin = useMemo(
    () =>
      AutoScroll({
        playOnInit: true,
        speed,
        startDelay: 0,
        stopOnInteraction: false,
        stopOnMouseEnter: false,
        stopOnFocusIn: false,
      }),
    [speed],
  )
  const carouselPlugins = useMemo(() => [autoScrollPlugin], [autoScrollPlugin])

  useEffect(() => {
    if (!api) return
    const plugins = api.plugins() as Record<
      string,
      { isPlaying?: () => boolean; play?: () => void } | undefined
    >
    const autoScroll = plugins.autoScroll
    if (!autoScroll?.play) return

    const play = () => {
      if (typeof autoScroll.isPlaying === 'function' && autoScroll.isPlaying()) return
      autoScroll.play?.()
    }

    play()
    const t0 = window.setTimeout(play, 50)
    const t1 = window.setTimeout(play, 400)
    api.on('reInit', play)
    api.on('settle', play)

    return () => {
      window.clearTimeout(t0)
      window.clearTimeout(t1)
      api.off('reInit', play)
      api.off('settle', play)
    }
  }, [api])

  return (
    <section className={cn('py-10 md:py-12', className)}>
      <div
        className={cn(
          'mx-auto w-full',
          strip &&
            'border-y border-[color:var(--ds-logo-strip-border)] bg-[color:var(--ds-logo-strip-bg)]',
        )}
      >
        <div className="mx-auto w-full max-w-5xl px-4 pt-6 text-center md:pt-7">
        <p
          className={cn(
            'logos3-heading text-[13px] font-medium uppercase tracking-[0.18em] text-[color:var(--ds-logo-heading)]',
            headingClassName,
          )}
        >
          {heading}
        </p>
      </div>
      <div className="pb-6 pt-5 md:pb-7 md:pt-6">
        <div
          className={cn(
            'relative mx-auto w-full',
            containerClassName ?? 'lg:max-w-5xl',
          )}
        >
          <Carousel
            className="w-full"
            setApi={setApi}
            opts={{ loop: true }}
            plugins={carouselPlugins}
          >
            <CarouselContent className="ml-0">
              {items.map((logo, i) => (
                <CarouselItem
                  key={`${logo.id}-${i}`}
                  className="flex basis-1/4 justify-center pl-0 sm:basis-1/5"
                >
                  <div className="flex shrink-0 items-center justify-center">
                    <img
                      src={logo.image}
                      alt={logo.description}
                      className={cn(
                        grayscale ? 'opacity-60 grayscale' : 'opacity-85',
                        logo.className,
                      )}
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[color:var(--ds-logo-strip-fade)] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[color:var(--ds-logo-strip-fade)] to-transparent" />
        </div>
      </div>
      </div>
    </section>
  )
}
