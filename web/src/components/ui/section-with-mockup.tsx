'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

export type SectionWithMockupProps = {
  title: string | ReactNode
  description: string | ReactNode
  primaryImageSrc: string
  reverseLayout?: boolean
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.2,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: 'easeOut' as const },
  },
}

export function SectionWithMockup({
  title,
  description,
  primaryImageSrc,
  reverseLayout = false,
}: SectionWithMockupProps) {
  const layoutClasses = reverseLayout
    ? 'md:grid-cols-2 md:grid-flow-col-dense'
    : 'md:grid-cols-2'

  const textOrderClass = reverseLayout ? 'md:col-start-2' : ''
  const imageOrderClass = reverseLayout ? 'md:col-start-1' : ''

  return (
    <section className="relative overflow-hidden bg-white py-24 md:py-48">
      <div className="container relative z-10 mx-auto w-full max-w-[1220px] px-6 md:px-10">
        <motion.div
          className={`grid w-full grid-cols-1 items-center gap-16 md:gap-8 ${layoutClasses}`}
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.div
            className={`mx-auto mt-10 flex max-w-[546px] flex-col items-start gap-4 md:mx-0 md:mt-0 ${textOrderClass}`}
            variants={itemVariants}
          >
            <div className="space-y-2 md:space-y-1">
              <h2 className="text-3xl leading-tight font-semibold text-[var(--ds-navy)] md:text-[40px] md:leading-[53px]">
                {title}
              </h2>
            </div>

            <p className="text-sm leading-6 text-[var(--ds-muted)] md:text-[15px]">{description}</p>
          </motion.div>

          <motion.div
            className={`relative mx-auto mt-10 w-full max-w-[520px] md:mt-0 md:max-w-[860px] ${imageOrderClass}`}
            variants={itemVariants}
          >
            <motion.div
              className="relative h-[460px] w-full overflow-hidden rounded-[32px] border border-[var(--ds-border)] bg-white shadow-[0_8px_40px_rgba(26,26,46,0.08)] md:h-[680px]"
              initial={{ y: 0 }}
              whileInView={{ y: reverseLayout ? 12 : 16 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              viewport={{ once: true, amount: 0.5 }}
            >
              <div
                className="h-full w-full bg-cover bg-center"
                style={{
                  backgroundImage: `url(${primaryImageSrc})`,
                }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 z-0 h-px w-full bg-[var(--ds-border)]" />
    </section>
  )
}
