/** Feature-level Claude calls — up to 2000 output tokens. */
export const PROACTIVE_FEATURE_MODEL = 'claude-sonnet-4-6'
export const PROACTIVE_FEATURE_MAX_OUTPUT_TOKENS = 2000

/** Fast, faithful dictation polish — latency-sensitive. */
export const DICTATION_POLISH_MODEL = 'claude-3-5-haiku-20241022'
export const DICTATION_POLISH_MAX_OUTPUT_TOKENS = 400

export const PROACTIVE_WRITING_MODES = [
  'rewrite',
  'shorten',
  'expand',
  'formal',
  'casual',
  'grammar',
] as const

export type ProactiveWritingMode = (typeof PROACTIVE_WRITING_MODES)[number]

export const PROACTIVE_DRAFT_TONES = ['professional', 'friendly', 'direct', 'formal'] as const

export type ProactiveDraftTone = (typeof PROACTIVE_DRAFT_TONES)[number]

export type ProactiveExtractedActionItem = {
  id: string
  text: string
  owner: string | null
  deadline: string | null
  priority: 'high' | 'medium' | 'low'
  completed: boolean
}

export type ProactiveSummaryResult = {
  bullets: string[]
  takeaway: string
  decisions: string[]
  openQuestions: string[]
  markdown: string
}

export type ProactiveDraftGoal =
  | 'follow_up'
  | 'share_update'
  | 'ask_for_something'
  | 'confirm_next_steps'

export type ProactiveFeatureKind =
  | 'writing'
  | 'summary'
  | 'action_items'
  | 'draft'

export type ProactiveStreamEvent =
  | { type: 'chunk'; requestId: string; text: string }
  | { type: 'done'; requestId: string; fullText: string }
  | { type: 'error'; requestId: string; message: string }

export type ProactivePanelPayload =
  | { kind: 'writing'; sourceText: string; result: string; mode: ProactiveWritingMode }
  | { kind: 'summary'; result: ProactiveSummaryResult }
  | { kind: 'action_items'; items: ProactiveExtractedActionItem[] }
  | { kind: 'draft'; text: string; tone: ProactiveDraftTone; goal: ProactiveDraftGoal | null }
