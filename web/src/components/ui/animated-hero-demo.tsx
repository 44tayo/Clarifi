'use client'

import { MoveRight, PhoneCall } from 'lucide-react'

import { AnimatedHero } from '@/components/ui/animated-hero'
import { Button } from '@/components/ui/button'

export function AnimatedHeroDemo() {
  return (
    <div className="block w-full">
      <AnimatedHero
        lead="This is something"
        words={['amazing', 'new', 'wonderful', 'beautiful', 'smart']}
        description="Managing a small business today is already tough. Avoid further complications by ditching outdated, tedious trade methods. Our goal is to streamline SMB trade, making it easier and faster than ever."
        eyebrow={{ label: 'Read our launch article', href: '/blog' }}
        actions={
          <>
            <Button size="lg" className="gap-2" variant="outline">
              Jump on a call
              <PhoneCall className="h-4 w-4" aria-hidden />
            </Button>
            <Button size="lg" className="gap-2">
              Sign up here
              <MoveRight className="h-4 w-4" aria-hidden />
            </Button>
          </>
        }
      />
    </div>
  )
}
