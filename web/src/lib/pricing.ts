export type BillingInterval = 'monthly' | 'annual'

export type PricingPlanId = 'free' | 'pro' | 'pro_plus'

export type PricingPlan = {
  id: PricingPlanId
  name: string
  audience: string
  price: string
  period: string
  billedNote?: string
  savingsNote?: string
  badge?: string
  tagline: string
  cta: string
  features: string[]
}

/** Days of free trial on Pro and Pro+ Stripe subscriptions. */
export const TRIAL_DAYS = 30

const PLAN_AMOUNTS: Record<'pro' | 'pro_plus', { monthly: number; annualTotal: number }> = {
  pro: { monthly: 19, annualTotal: 180 },
  pro_plus: { monthly: 39, annualTotal: 348 },
}

export function annualSavings(planId: 'pro' | 'pro_plus') {
  const { monthly, annualTotal } = PLAN_AMOUNTS[planId]
  const monthlyYearTotal = monthly * 12
  const amountSaved = monthlyYearTotal - annualTotal
  const percentSaved = Math.round((amountSaved / monthlyYearTotal) * 100)
  const unit = planId === 'pro_plus' ? '/seat' : ''
  return {
    amountSaved,
    percentSaved,
    label: `Save $${amountSaved}${unit}/year (${percentSaved}%)`,
  }
}

export function maxAnnualSavingsPercent() {
  return Math.max(annualSavings('pro').percentSaved, annualSavings('pro_plus').percentSaved)
}

export const PRICING_FEATURES = [
  {
    label: '30-day free trial',
    pro: 'Included',
    proPlus: 'Included',
  },
  {
    label: 'Note history',
    pro: 'Unlimited',
    proPlus: 'Unlimited',
  },
  {
    label: 'AI messages',
    pro: 'Unlimited',
    proPlus: 'Unlimited',
  },
  {
    label: 'Meeting notetaking',
    pro: 'Unlimited',
    proPlus: 'Unlimited',
  },
  {
    label: 'Custom prompting',
    pro: 'Unlimited files and customization',
    proPlus: 'Unlimited files and customization',
  },
  {
    label: 'Custom keybinds',
    pro: true,
    proPlus: true,
  },
  {
    label: 'Screen context',
    pro: true,
    proPlus: true,
  },
  {
    label: 'Shared team communities',
    pro: false,
    proPlus: true,
  },
  {
    label: 'Share meetings, notes, and summaries',
    pro: false,
    proPlus: true,
  },
  {
    label: 'Folder organization',
    pro: false,
    proPlus: true,
  },
  {
    label: 'Built for',
    pro: 'Individuals',
    proPlus: 'Teams',
  },
] as const

/** Public pricing cards — Pro and Pro+ only (both include a 30-day free trial). */
export function getPricingPlans(interval: BillingInterval = 'monthly'): PricingPlan[] {
  const isAnnual = interval === 'annual'

  return [
    {
      id: 'pro',
      name: 'Pro',
      audience: 'Individual',
      price: isAnnual ? '$15' : '$19',
      period: isAnnual ? '/ month' : '/ month',
      billedNote: isAnnual ? 'Billed $180 annually after trial' : 'After 30-day free trial',
      savingsNote: isAnnual ? annualSavings('pro').label : undefined,
      badge: '30-day free trial',
      tagline: 'Full Clarifi for solo operators — try free for 30 days.',
      cta: 'Start 30-day free trial',
      features: [
        '30-day free trial — cancel anytime',
        'Unlimited meeting notetaking',
        'Unlimited note history',
        'Unlimited AI responses',
        'Unlimited custom prompting',
        'Custom keybinds',
        'Priority support',
      ],
    },
    {
      id: 'pro_plus',
      name: 'Pro+',
      audience: 'Team',
      badge: '30-day free trial',
      price: isAnnual ? '$29' : '$39',
      period: '/ seat / month',
      billedNote: isAnnual
        ? 'Billed $348 per seat annually after trial'
        : 'After 30-day free trial',
      savingsNote: isAnnual ? annualSavings('pro_plus').label : undefined,
      tagline: 'Everything in Pro for teams — try free for 30 days.',
      cta: 'Start 30-day free trial',
      features: [
        '30-day free trial — cancel anytime',
        'Everything in Pro',
        'Unlimited note history',
        'Shared team communities',
        'Share meetings, notes, and summaries',
        'Folder organization',
        'Team-ready seats',
        'Priority support',
      ],
    },
  ]
}
