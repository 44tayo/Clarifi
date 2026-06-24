export type Plan = 'free' | 'pro' | 'pro_plus'

export type Feature =
  | 'ai_chat'
  | 'ai_transcribe'
  | 'voice_dictation'
  | 'custom_modes'
  | 'custom_keybinds'
  | 'premium_models'
  | 'screen_context'
  | 'gmail'
  | 'hubspot'
  | 'transcript_export'
  | 'stealth'
  | 'communities'

const PRO_FEATURES: Feature[] = [
  'ai_chat',
  'ai_transcribe',
  'voice_dictation',
  'custom_modes',
  'custom_keybinds',
  'premium_models',
  'screen_context',
  'gmail',
  'hubspot',
  'transcript_export',
]

const PRO_PLUS_FEATURES: Feature[] = [...PRO_FEATURES, 'stealth', 'communities']

export function normalizePlan(value: unknown): Plan {
  if (value === 'pro' || value === 'pro_plus') return value
  return 'free'
}

export function isPaidPlan(plan: Plan): boolean {
  return plan === 'pro' || plan === 'pro_plus'
}

export function getEntitlements(plan: Plan): Feature[] {
  if (plan === 'pro_plus') return [...PRO_PLUS_FEATURES]
  if (plan === 'pro') return [...PRO_FEATURES]
  return []
}

export function hasFeature(plan: Plan, feature: Feature): boolean {
  return getEntitlements(plan).includes(feature)
}

export function upgradePlanForFeature(feature: Feature): 'pro' | 'pro_plus' {
  return feature === 'stealth' || feature === 'communities' ? 'pro_plus' : 'pro'
}
