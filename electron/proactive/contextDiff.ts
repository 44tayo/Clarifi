import type { ProactiveScreenAnalysis } from './types'

/** Stable fingerprint for meaningful-change detection. */
export function analysisFingerprint(analysis: ProactiveScreenAnalysis): string {
  const elements = [...analysis.detected_elements].map((e) => e.trim().toLowerCase()).sort()
  const actionIds = analysis.suggested_actions
    .map((a) => a.action_id.trim().toLowerCase())
    .sort()
  return JSON.stringify({
    context_type: analysis.context_type,
    elements,
    actionIds,
  })
}

export function hasMeaningfulContextChange(
  previous: string | null,
  next: ProactiveScreenAnalysis,
): boolean {
  if (!previous) return true
  return previous !== analysisFingerprint(next)
}
