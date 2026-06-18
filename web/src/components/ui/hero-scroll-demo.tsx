'use client'

import Image from 'next/image'
import { ContainerScroll } from '@/components/ui/container-scroll-animation'

/** Standalone demo — useful for previews or Storybook-style testing. */
export function HeroScrollDemo() {
  return (
    <div className="flex flex-col overflow-hidden">
      <ContainerScroll
        titleComponent={
          <>
            <h1 className="text-4xl font-semibold text-[var(--cl-navy,#1a1a2e)]">
              Unleash the power of <br />
              <span className="text-4xl md:text-[6rem] font-bold mt-1 leading-none bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
                Scroll Animations
              </span>
            </h1>
          </>
        }
      >
        <Image
          src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1400&q=80"
          alt="Team on a video call"
          height={720}
          width={1400}
          className="mx-auto rounded-2xl object-cover h-full w-full object-center"
          draggable={false}
        />
      </ContainerScroll>
    </div>
  )
}
