/** Claude model for memory summarisation, briefing, and learning analysis. */
export const MEMORY_ANALYSIS_MODEL = 'claude-sonnet-4-6'

/** Approximate chars per token for context window budgeting. */
export const MEMORY_CHARS_PER_TOKEN = 4

/** Max tokens allocated to injected memory context in AI prompts. */
export const MEMORY_CONTEXT_TOKEN_BUDGET = 3000

/** Re-summarise when interaction/chunk count increases by this much. */
export const SUMMARY_REFRESH_DELTA = 3

/** Run adaptive learning analysis every N completed sessions. */
export const LEARNING_SESSION_INTERVAL = 10

/** Local redirect port for Google Calendar OAuth. */
export const CALENDAR_OAUTH_PORT = 8765

export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'openid',
  'email',
]
