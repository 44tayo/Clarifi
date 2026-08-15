'use client'

import { CosmicParallaxBg } from '@/components/ui/parallax-cosmic-background'

const DemoOne = () => {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <CosmicParallaxBg head="EaseMize" text="Easy, customizeable, Best" loop={true} />
    </div>
  )
}

export { DemoOne }
