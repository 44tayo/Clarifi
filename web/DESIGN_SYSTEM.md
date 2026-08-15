# Clarifi Design System

Tokens and marketing primitives used on the landing page and shared app UI. New features should use these building blocks so layout, color, and typography stay consistent.

## Token sources

| File | Purpose |
|------|---------|
| `src/styles/design-tokens.css` | CSS custom properties (`--ds-*`) on `:root` |
| `src/lib/design-tokens.ts` | TypeScript constants for mocks and programmatic use |
| `src/app/globals.css` | Imports tokens + `design-system.css`; Tailwind `@theme` aliases |
| `src/components/marketing/design-system.css` | Feature grid, cards, and mock visual classes (`ds-*`) |

Legacy marketing CSS still uses `--cl-*` aliases, which map to `--ds-*` in `design-tokens.css`.

## Colors

| Token | Value | Use |
|-------|-------|-----|
| `--ds-blue` | `#2b6cff` | Primary CTA, buttons, links |
| `--ds-blue-hover` | `#1a5ae8` | Button hover |
| `--ds-hero-accent` | `#60b4ff` | Hero rotating word only |
| `--ds-navy` | `#1a1a2e` | Headings, dark text |
| `--ds-muted` | `#6b7280` | Body secondary text |
| `--ds-surface-feature` | `#f4f4f5` | Feature card background |
| `--ds-surface-visual` | `#ececef` | Feature card visual area |

## Components (`@/components/marketing`)

### `LandingSection`

Wraps a marketing section. Uses existing `.landing-section` styles from `landing.css`.

```tsx
<LandingSection tone="default" id="features" className="my-section">
  ...
</LandingSection>
```

`tone`: `default` | `tint` | `dark`

### `LandingSectionHeader`

Centered title + subtitle with scroll-reveal.

```tsx
<LandingSectionHeader
  title="Section title"
  subtitle="Optional subtitle"
/>
```

### `MarketingFeatureGrid` + `MarketingFeatureCard`

5-card layout (2 wide top + 3 bottom). Grid stacks to single column below 900px.

```tsx
<MarketingFeatureGrid>
  <MarketingFeatureCard
    variant="wide"   // wide | narrow | third
    title="Feature name"
    description="Short description."
    visual={<MyFeatureMock />}
  />
</MarketingFeatureGrid>
```

### `MarketingFeatureMock`

Wrapper for card visuals. Layout presets: `default` | `summary` | `chat` | `notes` | `share`.

Use `ds-mock-*` classes inside for doc bubbles, chips, etc.

## Adding a new feature card

1. Add a `MarketingFeatureCard` to a `MarketingFeatureRow` (or your section’s data).
2. Pick `variant`: `wide` (4 cols), `narrow` (2 cols), or `third` (2 cols).
3. Build a visual with `MarketingFeatureMock` + `ds-mock-*` classes, or compose custom content inside `MarketingFeatureVisual`.
4. For accent colors in mocks, import from `featureAccentColors` in `@/lib/design-tokens`.

## Buttons

| Component | When to use |
|-----------|-------------|
| `Button` (`@/components/ui/button`) | Default app UI — shadcn `rounded-lg`, CVA variants (`default`, `outline`, `secondary`, `ghost`, `link`, `destructive`) |
| `ButtonWithArrow` (`@/components/ui/button-with-arrow`) | Primary marketing / conversion CTAs — `Button` + trailing `ArrowRight` with hover slide |
| `.landing-cta` | Marketing pages (legacy CSS in `landing.css`) |
| `.download-mac-btn` | Download CTAs (matches `Button` sizing) |

### Primary CTA pattern

```tsx
import { ButtonWithArrow } from '@/components/ui/button-with-arrow'

<ButtonWithArrow size="lg" onClick={handleClick}>
  Get early access
</ButtonWithArrow>
```

Dependencies: `@radix-ui/react-slot`, `class-variance-authority`, `lucide-react` (already installed).

## Section layout

- Max content width: `--ds-content-max` (1100px)
- Section padding: `--ds-section-py` / `--ds-section-px`
- Section headers: `.landing-section-header` (via `LandingSectionHeader`)

## Hero-specific (not in design-system components)

Hero overrides live in `marketing-page-sections.css`:

- Rotating word: `#60b4ff` (`--ds-hero-accent`)
- “Trusted by” heading: monospace, `#94a3b8`
- Nav spacing: `0.5cm` top, `1.5cm` below nav before headline
