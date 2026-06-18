'use client'

import type { HTMLMotionProps } from 'framer-motion'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import './spotlight-background.css'

type SpotlightProps = HTMLMotionProps<'div'> & {
  className?: string
}

function Spotlight({ className, ...props }: SpotlightProps) {
  return <motion.div className={cn('spotlight', className)} {...props} />
}

type SpotlightBackgroundProps = {
  children?: ReactNode
  className?: string
}

export function SpotlightBackground({ children, className }: SpotlightBackgroundProps) {
  return (
    <div className={cn('spotlight-container', className)}>
      <div className="spotlight-overlay" aria-hidden>
        <Spotlight
          initial={{ x: '-50%', y: '-50%', rotate: '0deg' }}
          animate={{
            x: ['-50%', '-30%', '-70%', '-50%'],
            y: ['-50%', '-70%', '-30%', '-50%'],
            rotate: ['0deg', '15deg', '-15deg', '0deg'],
          }}
          transition={{
            duration: 12,
            ease: 'easeInOut',
            repeat: Infinity,
            repeatType: 'mirror',
          }}
          className="spotlight-left"
        />

        <Spotlight
          initial={{ x: '0%', y: '0%', rotate: '0deg' }}
          animate={{
            x: ['0%', '20%', '-20%', '0%'],
            y: ['0%', '30%', '10%', '0%'],
            rotate: ['-20deg', '0deg', '20deg', '-20deg'],
          }}
          transition={{
            duration: 15,
            ease: 'easeInOut',
            repeat: Infinity,
            repeatType: 'mirror',
            delay: 3,
          }}
          className="spotlight-mid"
        />

        <Spotlight
          initial={{ x: '0%', y: '0%', rotate: '10deg' }}
          animate={{
            x: ['0%', '-30%', '10%', '0%'],
            y: ['0%', '-20%', '20%', '0%'],
            rotate: ['10deg', '-10deg', '25deg', '10deg'],
          }}
          transition={{
            duration: 18,
            ease: 'easeInOut',
            repeat: Infinity,
            repeatType: 'mirror',
            delay: 5,
          }}
          className="spotlight-right"
        />
      </div>

      {children ? <div className="spotlight-content">{children}</div> : null}
    </div>
  )
}

export default SpotlightBackground
