export type Plan = 'free' | 'pro' | 'pro_plus'

export type Feature =
  | 'ai_chat'
  | 'ai_transcribe'
  | 'voice_dictation'
  | 'custom_modes'
  | 'custom_keybinds'
  | 'premium_models'
  | 'screen_context'
  | 'transcript_export'
  | 'communities'
  | 'share_meetings'
  | 'folders'

/** Core notetaking works during trial and on paid plans. */
const FREE_FEATURES: Feature[] = ['ai_chat', 'ai_transcribe', 'voice_dictation', 'folders']

const PRO_FEATURES: Feature[] = [
  ...FREE_FEATURES,
  'custom_modes',
  'custom_keybinds',
  'premium_models',
  'screen_context',
  'transcript_export',
]

const PRO_PLUS_FEATURES: Feature[] = [
  ...PRO_FEATURES,
  'communities',
  'share_meetings',
]

/** Unpaid / post-trial accounts may retain only a short recent window of
 * note history. Pro and Pro+ (including the 30-day free trial) keep full
 * history. */
export const FREE_HISTORY_RETENTION_DAYS = 30

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
  return [...FREE_FEATURES]
}

export function hasFeature(plan: Plan, feature: Feature): boolean {
  return getEntitlements(plan).includes(feature)
}

export function upgradePlanForFeature(feature: Feature): 'pro' | 'pro_plus' {
  if (feature === 'communities' || feature === 'share_meetings') {
    return 'pro_plus'
  }
  return 'pro'
}

export function getHistoryRetentionDays(plan: Plan): number {
  return isPaidPlan(plan) ? Number.POSITIVE_INFINITY : FREE_HISTORY_RETENTION_DAYS
}
