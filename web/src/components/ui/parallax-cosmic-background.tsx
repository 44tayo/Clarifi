'use client'

import React, { useEffect, useState } from 'react'

import './parallax-cosmic-background.css'

interface CosmicParallaxBgProps {
  /**
   * Main heading text (displayed large in the center)
   */
  head: string

  /**
   * Subtitle text (displayed below the heading)
   * Comma-separated string that will be split into animated parts
   */
  text: string

  /**
   * Whether the text animations should loop
   * @default true
   */
  loop?: boolean

  /**
   * Custom class name for additional styling
   */
  className?: string
}

/**
 * A cosmic parallax background component with animated stars and text
 */
const CosmicParallaxBg: React.FC<CosmicParallaxBgProps> = ({
  head,
  text,
  loop = true,
  className = '',
}) => {
  const [smallStars, setSmallStars] = useState<string>('')
  const [mediumStars, setMediumStars] = useState<string>('')
  const [bigStars, setBigStars] = useState<string>('')

  const textParts = text.split(',').map((part) => part.trim())

  const generateStarBoxShadow = (count: number): string => {
    const shadows: string[] = []

    for (let i = 0; i < count; i++) {
      const x = Math.floor(Math.random() * 2000)
      const y = Math.floor(Math.random() * 2000)
      shadows.push(`${x}px ${y}px #FFF`)
    }

    return shadows.join(', ')
  }

  useEffect(() => {
    setSmallStars(generateStarBoxShadow(700))
    setMediumStars(generateStarBoxShadow(200))
    setBigStars(generateStarBoxShadow(100))

    document.documentElement.style.setProperty(
      '--animation-iteration',
      loop ? 'infinite' : '1',
    )
  }, [loop])

  return (
    <div className={`cosmic-parallax-container ${className}`}>
      <div
        id="stars"
        style={
          {
            boxShadow: smallStars,
            '--stars-shadow': smallStars,
          } as React.CSSProperties
        }
        className="cosmic-stars"
      />
      <div
        id="stars2"
        style={
          {
            boxShadow: mediumStars,
            '--stars-shadow': mediumStars,
          } as React.CSSProperties
        }
        className="cosmic-stars-medium"
      />
      <div
        id="stars3"
        style={
          {
            boxShadow: bigStars,
            '--stars-shadow': bigStars,
          } as React.CSSProperties
        }
        className="cosmic-stars-large"
      />

      <div id="horizon">
        <div className="glow" />
      </div>
      <div id="earth" />

      <div id="title">{head.toUpperCase()}</div>
      <div id="subtitle">
        {textParts.map((part, index) => (
          <React.Fragment key={index}>
            <span className={`subtitle-part-${index + 1}`}>{part.toUpperCase()}</span>
            {index < textParts.length - 1 && ' '}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

export { CosmicParallaxBg }
