/** Clarifi design tokens for use in TS/TSX (mirrors src/styles/design-tokens.css). */

export const colors = {
  blue: '#2b6cff',
  blueHover: '#1a5ae8',
  heroAccent: '#60b4ff',
  navy: '#1a1a2e',
  charcoal: '#1c1c2e',
  muted: '#6b7280',
  mutedHero: '#94a3b8',
  lavender: '#dde2ee',
  lavenderSoft: '#eef1f8',
  border: '#e8ecf4',
  card: '#f7f8fc',
  surfaceFeature: '#f4f4f5',
  surfaceVisual: '#ececef',
} as const

export const layout = {
  contentMax: '1100px',
  sectionPy: '5.5rem',
  sectionPx: '2rem',
} as const

export const radii = {
  button: '0.75rem',
  card: '1rem',
  visual: '0.75rem',
  mock: '0.65rem',
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
