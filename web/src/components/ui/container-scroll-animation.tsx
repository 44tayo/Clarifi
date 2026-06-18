'use client'

import React, { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion'

import { cn } from '@/lib/utils'

type ContainerScrollProps = {
  titleComponent: string | React.ReactNode
  children: React.ReactNode
  compact?: boolean
  static?: boolean
}

export function ContainerScroll(props: ContainerScrollProps) {
  if (props.static) {
    return <StaticContainerScroll {...props} />
  }

  return <AnimatedContainerScroll {...props} />
}

function StaticContainerScroll({
  titleComponent,
  children,
  compact = false,
}: ContainerScrollProps) {
  return (
    <div className={cn('relative w-full', compact ? 'p-0 md:p-4' : 'p-2 md:p-20')}>
      <div className={cn('relative w-full', compact ? 'py-2 md:py-8' : 'py-10 md:py-40')}>
        <div className="mx-auto max-w-5xl text-center">{titleComponent}</div>
        <DemoCard>{children}</DemoCard>
      </div>
    </div>
  )
}

function AnimatedContainerScroll({
  titleComponent,
  children,
  compact = false,
}: ContainerScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
  })
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => {
      window.removeEventListener('resize', checkMobile)
    }
  }, [])

  const scaleDimensions = () => {
    return isMobile ? [0.7, 0.9] : [1.05, 1]
  }

  const rotate = useTransform(scrollYProgress, [0, 1], [20, 0])
  const scale = useTransform(scrollYProgress, [0, 1], scaleDimensions())
  const translate = useTransform(scrollYProgress, [0, 1], [0, -100])

  return (
    <div
      className={cn(
        'relative flex h-[60rem] items-center justify-center md:h-[80rem]',
        compact ? 'p-0 md:p-4' : 'p-2 md:p-20',
      )}
      ref={containerRef}
    >
      <div
        className={cn('relative w-full', compact ? 'py-2 md:py-8' : 'py-10 md:py-40')}
        style={{
          perspective: '1000px',
        }}
      >
        <Header translate={translate} titleComponent={titleComponent} />
        <AnimatedDemoCard rotate={rotate} scale={scale}>
          {children}
        </AnimatedDemoCard>
      </div>
    </div>
  )
}

type HeaderProps = {
  translate: MotionValue<number>
  titleComponent: string | React.ReactNode
}

export function Header({ translate, titleComponent }: HeaderProps) {
  return (
    <motion.div
      style={{
        translateY: translate,
      }}
      className="mx-auto max-w-5xl text-center"
    >
      {titleComponent}
    </motion.div>
  )
}

type AnimatedDemoCardProps = {
  rotate: MotionValue<number>
  scale: MotionValue<number>
  children: React.ReactNode
}

function AnimatedDemoCard({ rotate, scale, children }: AnimatedDemoCardProps) {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
        boxShadow:
          '0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003',
      }}
      className="mx-auto -mt-12 h-[30rem] w-full max-w-5xl rounded-[30px] border-4 border-[#6C6C6C] bg-[#222222] p-2 shadow-2xl md:h-[40rem] md:p-6"
    >
      <div className="h-full w-full overflow-hidden rounded-2xl bg-gray-100 dark:bg-zinc-900 md:rounded-2xl md:p-4">
        {children}
      </div>
    </motion.div>
  )
}

/** @deprecated Use AnimatedDemoCard internally. */
export const Card = AnimatedDemoCard

function DemoCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-auto -mt-12 h-[30rem] w-full max-w-5xl rounded-[30px] border-4 border-[#6C6C6C] bg-[#222222] p-2 shadow-2xl md:h-[40rem] md:p-6"
      style={{
        boxShadow:
          '0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003',
      }}
    >
      <div className="h-full w-full overflow-hidden rounded-2xl bg-gray-100 dark:bg-zinc-900 md:rounded-2xl md:p-4">
        {children}
      </div>
    </div>
  )
}
