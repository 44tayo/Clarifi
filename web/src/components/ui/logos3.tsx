'use client'

import AutoScroll from 'embla-carousel-auto-scroll'

import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel'
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
  heading = 'Trusted by professionals at',
  logos = DEFAULT_LOGOS,
  className,
}: Logos3Props) {
  return (
    <section className={cn('py-10 md:py-12', className)}>
      <div className="mx-auto w-full max-w-5xl px-4 text-center">
        <p className="logos3-heading font-mono text-[13px] font-normal tracking-[0.01em] text-slate-400">
          {heading}
        </p>
      </div>
      <div className="pt-6 md:pt-8">
        <div className="relative mx-auto flex items-center justify-center lg:max-w-5xl">
          <Carousel
            opts={{ loop: true }}
            plugins={[AutoScroll({ playOnInit: true, speed: 0.75 })]}
          >
            <CarouselContent className="ml-0">
              {logos.map((logo) => (
                <CarouselItem
                  key={logo.id}
                  className="flex basis-1/3 justify-center pl-0 sm:basis-1/4 md:basis-1/5 lg:basis-1/6"
                >
                  <div className="mx-8 flex shrink-0 items-center justify-center">
                    <img
                      src={logo.image}
                      alt={logo.description}
                      className={cn('opacity-60 grayscale', logo.className)}
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white to-transparent" />
        </div>
      </div>
    </section>
  )
}
