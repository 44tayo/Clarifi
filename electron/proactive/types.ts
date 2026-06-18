export type ProactiveContextType =
  | 'email_reading'
  | 'email_writing'
  | 'document_reading'
  | 'meeting'
  | 'browsing'
  | 'slack'
  | 'other'

export type ProactiveActionPriority = 'high' | 'medium' | 'low'

export type ProactiveSuggestedAction = {
  action_id: string
  label: string
  description: string
  priority: ProactiveActionPriority
}

/** Structured JSON returned by the screen analysis Claude call. */
export type ProactiveScreenAnalysis = {
  context_type: ProactiveContextType
  activity_summary: string
  detected_elements: string[]
  suggested_actions: ProactiveSuggestedAction[]
}

export type ProactiveCaptureMode = 'full_screen' | 'active_window'

export type ProactiveFeatureToggles = {
  screenWatch: boolean
  writingAssistant: boolean
  autoSummarise: boolean
  actionItems: boolean
  draftGenerator: boolean
}

export type ProactiveSettings = {
  enabled: boolean
  analysisIntervalMs: number
  suggestionAutoDismissMs: number
  maxVisibleSuggestions: number
  captureMode: ProactiveCaptureMode
  appWhitelist: string[]
  appBlacklist: string[]
  clipboardPollMs: number
  features: ProactiveFeatureToggles
}

export type ProactiveEngineState = {
  running: boolean
  enabled: boolean
  lastAnalysisAt: number | null
  lastError: string | null
  analysis: ProactiveScreenAnalysis | null
  fingerprint: string | null
  suggestionsVisibleUntil: number | null
}

export type ProactiveSuggestionsPayload = {
  analysis: ProactiveScreenAnalysis
  fingerprint: string
  capturedAt: number
  expiresAt: number
}
