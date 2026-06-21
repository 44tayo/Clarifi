'use client'

import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { LandingSectionHeader } from '@/components/marketing'
import { Button } from '@/components/ui/button'
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel'
import { cn } from '@/lib/utils'

export type GalleryItem = {
  id: string
  title: string
  summary: string
  visual?: ReactNode
  visualClassName?: string
  image?: string
  url?: string
}

type Gallery6Props = {
  heading?: string
  subtitle?: string
  items?: GalleryItem[]
  id?: string
  className?: string
}

export function Gallery6({
  heading = 'View some of our features',
  subtitle = 'Our collection of Clarifi features for your convenience',
  items = [],
  id = 'features',
  className,
}: Gallery6Props) {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  useEffect(() => {
    if (!carouselApi) {
      return
    }

    const updateSelection = () => {
      setCanScrollPrev(carouselApi.canScrollPrev())
      setCanScrollNext(carouselApi.canScrollNext())
    }

    updateSelection()
    carouselApi.on('select', updateSelection)

    return () => {
      carouselApi.off('select', updateSelection)
    }
  }, [carouselApi])

  return (
    <section
      id={id}
      className={cn(
        'landing-section landing-section-tint waitlist-features-section gallery6',
        className,
      )}
      data-reveal
    >
      <div className="gallery6__header mb-8 flex flex-col justify-between md:mb-10 md:flex-row md:items-end lg:mb-12">
        <LandingSectionHeader
          title={heading}
          subtitle={subtitle}
          centered={false}
          className="gallery6__title mb-0"
        />
        <div className="mt-6 flex shrink-0 items-center justify-start gap-2 md:mt-0">
          <Button
            size="icon"
            variant="outline"
            onClick={() => carouselApi?.scrollPrev()}
            disabled={!canScrollPrev}
            className="disabled:pointer-events-auto"
            aria-label="Previous feature"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => carouselApi?.scrollNext()}
            disabled={!canScrollNext}
            className="disabled:pointer-events-auto"
            aria-label="Next feature"
          >
            <ArrowRight className="size-5" />
          </Button>
        </div>
      </div>

      <div className="gallery6__carousel w-full">
        <Carousel
          setApi={setCarouselApi}
          opts={{
            align: 'start',
            breakpoints: {
              '(max-width: 768px)': {
                dragFree: true,
              },
            },
          }}
        >
          <CarouselContent className="gallery6__track">
            {items.map((item) => (
              <CarouselItem key={item.id} className="gallery6__item pl-0">
                <article className="ds-feature-card ds-feature-third gallery6__card">
                  <div className={cn('ds-feature-visual', item.visualClassName)}>
                    {item.visual ??
                      (item.image ? (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="h-full w-full object-cover object-center"
                        />
                      ) : null)}
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                </article>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </section>
  )
}
