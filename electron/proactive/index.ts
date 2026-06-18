export {
  dismissProactiveSuggestions,
  getCurrentProactiveSuggestions,
  getProactiveEngineState,
  getProactiveSettings,
  initializeProactiveEngine,
  startProactiveEngine,
  stopProactiveEngine,
  updateProactiveSettings,
} from './proactiveEngine'
export { analyzeScreenCapture, PROACTIVE_ANALYSIS_MAX_OUTPUT_TOKENS, PROACTIVE_ANALYSIS_MODEL } from './screenAnalyzer'
export { analysisFingerprint, hasMeaningfulContextChange } from './contextDiff'
export { DEFAULT_PROACTIVE_SETTINGS, loadProactiveSettings, saveProactiveSettings } from './proactiveSettings'
export { handleProactiveIpc } from './proactiveHandlers'
export { summariseMeetingTranscript } from './featureHandlers'
export type {
  ProactiveActionPriority,
  ProactiveCaptureMode,
  ProactiveContextType,
  ProactiveEngineState,
  ProactiveFeatureToggles,
  ProactiveScreenAnalysis,
  ProactiveSettings,
  ProactiveSuggestedAction,
  ProactiveSuggestionsPayload,
} from './types'
export type {
  ProactiveDraftGoal,
  ProactiveDraftTone,
  ProactiveExtractedActionItem,
  ProactiveFeatureKind,
  ProactivePanelPayload,
  ProactiveSummaryResult,
  ProactiveWritingMode,
} from './featureTypes'
