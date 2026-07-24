/** Clarifi design tokens for use in TS/TSX (mirrors src/styles/design-tokens.css). */

export const colors = {
  blue: '#2b6cff',
  blueHover: '#1a5ae8',
  heroAccent: '#60b4ff',
  navy: '#17181c',
  charcoal: '#1f2025',
  muted: '#5f6470',
  mutedHero: '#8e939e',
  lavender: '#e5e4e0',
  lavenderSoft: '#f1f0ed',
  border: '#eae9e5',
  card: '#f7f6f3',
  surfaceFeature: '#f5f4f1',
  surfaceVisual: '#efeeea',
} as const

export const layout = {
  contentMax: '1100px',
  sectionPy: '5.5rem',
  sectionPx: '2rem',
} as const

export const radii = {
  button: '0.5rem',
  card: '0.875rem',
  visual: '0.625rem',
  mock: '0.5rem',
} as const

/** Accent palette for feature mock chips, avatars, etc. */
export const featureAccentColors = {
  green: '#86efac',
  purple: '#c4b5fd',
  sky: '#93c5fd',
  orange: '#fdba74',
  cyan: '#7dd3fc',
  violet: '#a78bfa',
  blue: '#60a5fa',
} as const

export type MarketingFeatureVariant = 'wide' | 'narrow' | 'third'
