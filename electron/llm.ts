import fetch from 'node-fetch'
import { isProxyConfigured, proxyChat, proxySuggest } from './proxyClient'
import {
  CLARIFI_AUDIO_SESSION_CHAT_PROMPT,
  CLARIFI_ENTERPRISE_SYSTEM_PROMPT,
  CLARIFI_GENERAL_ANSWER_PROMPT,
  CLARIFI_SALES_DEFINE_PROMPT,
  CLARIFI_SALES_ANSWER_PROMPT,
  CLARIFI_SALES_LIVE_ASSIST_PROMPT,
  CLARIFI_SALES_SESSION_RECAP_PROMPT,
  CLARIFI_SALES_SUGGESTIONS_PROMPT,
  CLARIFI_SESSION_ANALYSIS_PROMPT,
  CLARIFI_SESSION_RECAP_PROMPT,
  CLARIFI_SPEAKER_INFERENCE_PROMPT,
  CLARIFI_SUGGESTIONS_SYSTEM_PROMPT,
} from './prompts'
import {
  collectDiarizedSpeakers,
  entriesToLines,
  type SpeakerLabels,
  type TranscriptEntry,
} from './transcriptUtils'
import { getOutputLanguageInstruction } from './audioPreferences'
import {
  resolveAnthropicApiModelId,
  SALES_ASSIST_ANTHROPIC_MODEL_ID,
} from '../shared/builtin-models'
import {
  getActiveMode,
  getActiveModel,
  getModelApiKey,
  getGeneralKnowledge,
  getProductKnowledge,
  getWorkKnowledge,
  type ModeConfig,
  type ModelConfig,
} from './userPreferences'
import {
  detectAnswerTrigger,
  detectSuggestionTrigger,
} from './salesAssistTrigger'
import { getMemoryContextForPrompt } from './memory/memoryHandlers'

export interface Suggestion {
  text: string
  type: 'response' | 'question' | 'action'
}

let lastTranscript = ''
let isProcessing = false
let lastAnalysisTranscript = ''
let isAnalyzing = false
let lastGeneralAnswerTriggerKey = ''
let lastGeneralStickyAnswer: SalesAssistAction | null = null
let isGeneralAnswering = false
let lastAnswerTriggerKey = ''
let lastStickyAnswer: SalesAssistAction | null = null
let lastSuggestionTriggerKey = ''
let lastStickySuggestions: SalesAssistAction[] = []
let definedTermsCache = new Map<string, SalesDefineEntry>()
let isSalesAnswering = false
let isSalesSuggesting = false
let isSalesDefining = false
let isSalesAssisting = false

export function resetSuggestionState(): void {
  lastTranscript = ''
  isProcessing = false
  lastAnalysisTranscript = ''
  isAnalyzing = false
  lastGeneralAnswerTriggerKey = ''
  lastGeneralStickyAnswer = null
  isGeneralAnswering = false
  lastAnswerTriggerKey = ''
  lastStickyAnswer = null
  lastSuggestionTriggerKey = ''
  lastStickySuggestions = []
  definedTermsCache = new Map()
  isSalesAnswering = false
  isSalesSuggesting = false
  isSalesDefining = false
  isSalesAssisting = false
}

export interface SessionEntity {
  name: string
  type: 'person' | 'company' | 'other'
}

export interface LiveSessionInsights {
  meetingIntro: string
  runningSummary: string
  topics: string[]
  entities: SessionEntity[]
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'
  keyMoments: string[]
  decisions: string[]
  openQuestions: string[]
}

export type SalesCardKind =
  | 'speak_now'
  | 'technical_lookup'
  | 'objection'
  | 'product_info'
  | 'discovery'
  | 'next_step'

export interface SalesAssistAction {
  kind: SalesCardKind
  label: string
  speakable: string
  context?: string
}

export interface SalesLiveAssist {
  actions: SalesAssistAction[]
}

export interface SalesDefineEntry {
  term: string
  speakable: string
  context?: string
}

export type SalesPanelPayload = {
  answer?: SalesAssistAction | null
  suggestions?: SalesAssistAction[]
  opening?: SalesAssistAction[] | null
}

export type SalesPanelBroadcast = SalesPanelPayload & {
  error?: SalesAssistError
}

export type SalesDefinePayload = {
  defines: SalesDefineEntry[]
}

export type SalesAssistErrorCode =
  | 'no_api_key'
  | 'assist_failed'
  | 'rate_limit_exceeded'

export type SalesAssistError = {
  error: SalesAssistErrorCode
  message: string
}

export type SalesLiveAssistResult = SalesLiveAssist | SalesAssistError

export function isSalesAssistError(
  result: SalesLiveAssistResult | null | undefined,
): result is SalesAssistError {
  return Boolean(
    result && typeof result === 'object' && 'error' in result && !('actions' in result),
  )
}

export interface SalesObjectionRecap {
  type: string
  summary: string
  handled: string
}

export interface SessionRecap {
  summary: string
  /** @deprecated use discussionPoints — kept for older saved sessions */
  highlights: string[]
  discussionPoints: string[]
  actionItems: string[]
  decisions: string[]
  openQuestions: string[]
  recapEmailDraft: string
  dealSummary?: string
  painPointsUncovered?: string[]
  objectionsRaised?: SalesObjectionRecap[]
  competitorsMentioned?: string[]
  budgetTimelineSignals?: string[]
  buyingSignals?: string[]
  stakeholderMap?: string[]
  riskFlags?: string[]
  mutualActionPlan?: string[]
  nextCallAgenda?: string[]
  prospectFollowUpEmail?: string
  internalCrmNote?: string
}

function parseJsonPayload<T>(text: string): T | null {
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean) as T
  } catch {
    return null
  }
}

type LlmCallConfig = {
  modelId: string
  apiKey: string
  provider: ModelConfig['provider']
}

type LlmCompletion =
  | { ok: true; text: string }
  | { ok: false; message: string }

function formatAnthropicError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      error?: { type?: string; message?: string }
    }
    const msg = parsed?.error?.message?.trim()
    const type = parsed?.error?.type
    if (msg && type === 'not_found_error') {
      return `Model not found: ${msg}. Try Claude Haiku 4.5 in Settings → Models.`
    }
    if (msg && type === 'authentication_error') {
      return 'Invalid Anthropic API key. Check ANTHROPIC_API_KEY in .env.local.'
    }
    if (msg) return msg
  } catch {
    // fall through
  }
  return 'Anthropic API request failed. Check your API key and model in Settings.'
}

async function resolveLlmCallConfig(): Promise<LlmCallConfig | null> {
  const model = getActiveModel()
  const apiKey = await getModelApiKey(model)
  if (!apiKey) return null
  const modelId =
    model.provider === 'anthropic'
      ? resolveAnthropicApiModelId(model.modelId)
      : model.modelId
  return { modelId, apiKey, provider: model.provider }
}

/** Sales assist always uses Haiku for speed; key from active Anthropic model or ANTHROPIC_API_KEY. */
async function resolveSalesAssistLlmConfig(): Promise<LlmCallConfig | null> {
  const { getAnthropicApiKey } = await import('./keys')
  const active = getActiveModel()
  const apiKey =
    (active.provider === 'anthropic' ? await getModelApiKey(active) : null) ??
    (await getAnthropicApiKey())
  if (!apiKey) return null
  return {
    modelId: SALES_ASSIST_ANTHROPIC_MODEL_ID,
    apiKey,
    provider: 'anthropic',
  }
}

async function completeWithLlmConfig(
  config: LlmCallConfig,
  systemPrompt: string,
  userContent: AnthropicContentBlock[] | string,
  maxTokens: number,
): Promise<LlmCompletion> {
  if (config.provider === 'openai') {
    const text = await callOpenAiChat(config, systemPrompt, userContent, maxTokens)
    return text
      ? { ok: true, text }
      : { ok: false, message: 'OpenAI request failed. Check your API key and model.' }
  }

  if (config.provider === 'gemini') {
    const text = await callGeminiChat(config, systemPrompt, userContent, maxTokens)
    return text
      ? { ok: true, text }
      : { ok: false, message: 'Gemini request failed. Check your API key and model.' }
  }

  return callAnthropicMessages(config, systemPrompt, userContent, maxTokens)
}

async function callAnthropicMessages(
  config: LlmCallConfig,
  systemPrompt: string,
  userContent: AnthropicContentBlock[] | string,
  maxTokens: number,
): Promise<LlmCompletion> {
  const content =
    typeof userContent === 'string' ? [{ type: 'text', text: userContent }] : userContent

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.modelId,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('LLM error:', err)
    return { ok: false, message: formatAnthropicError(err) }
  }

  const data = (await response.json()) as { content?: Array<{ text?: string }> }
  const text = data.content?.[0]?.text?.trim() ?? ''
  if (!text) {
    return { ok: false, message: 'Anthropic returned an empty response.' }
  }
  return { ok: true, text }
}

type OpenAiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

async function callOpenAiChat(
  config: LlmCallConfig,
  systemPrompt: string,
  userContent: AnthropicContentBlock[] | string,
  maxTokens: number,
): Promise<string | null> {
  let userMessage: string | OpenAiContentPart[]
  if (typeof userContent === 'string') {
    userMessage = userContent
  } else {
    const parts: OpenAiContentPart[] = []
    for (const block of userContent) {
      if (block.type === 'text') {
        parts.push({ type: 'text', text: block.text })
      } else if (block.type === 'image') {
        parts.push({
          type: 'image_url',
          image_url: {
            url: `data:${block.source.media_type};base64,${block.source.data}`,
          },
        })
      }
    }
    userMessage = parts
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelId,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('OpenAI LLM error:', err)
    return null
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return data.choices?.[0]?.message?.content?.trim() ?? null
}

type GeminiPart = {
  text?: string
  inlineData?: { mimeType: string; data: string }
}

async function callGeminiChat(
  config: LlmCallConfig,
  systemPrompt: string,
  userContent: AnthropicContentBlock[] | string,
  maxTokens: number,
): Promise<string | null> {
  const parts: GeminiPart[] = []

  if (typeof userContent === 'string') {
    parts.push({ text: userContent })
  } else {
    for (const block of userContent) {
      if (block.type === 'text') {
        parts.push({ text: block.text })
      } else if (block.type === 'image') {
        parts.push({
          inlineData: {
            mimeType: block.source.media_type,
            data: block.source.data,
          },
        })
      }
    }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.modelId)}:generateContent?key=${encodeURIComponent(config.apiKey)}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('Gemini LLM error:', err)
    return null
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null
}

async function completeWithActiveModel(
  systemPrompt: string,
  userContent: AnthropicContentBlock[] | string,
  maxTokens: number,
): Promise<string | null> {
  const config = await resolveLlmCallConfig()
  if (!config) return null

  if (config.provider === 'openai') {
    return callOpenAiChat(config, systemPrompt, userContent, maxTokens)
  }

  if (config.provider === 'gemini') {
    return callGeminiChat(config, systemPrompt, userContent, maxTokens)
  }

  const result = await callAnthropicMessages(config, systemPrompt, userContent, maxTokens)
  return result.ok ? result.text : null
}

export function isSalesAssistInFlight(): boolean {
  return isSalesAssisting || isSalesAnswering || isSalesSuggesting || isSalesDefining
}

export function getSalesCallOpeningActions(): SalesAssistAction[] {
  return [
    {
      kind: 'speak_now',
      label: 'Break the ice',
      speakable:
        "Thanks for making time today — before we dive in, how's your week going?",
      context: 'Warm opener',
    },
    {
      kind: 'speak_now',
      label: 'Quick intro',
      speakable:
        "I'd love a quick intro on your side, then we can align on what you'd like to get out of this call.",
      context: 'Set the agenda',
    },
  ]
}

function buildWorkKnowledgeBlock(workKnowledge: string): string {
  if (workKnowledge) {
    return `\n\n<work_knowledge>\n${workKnowledge}\n</work_knowledge>`
  }
  return `\n\n<work_knowledge>\nNo work context provided. Use only the live transcript.\n</work_knowledge>`
}

function buildGeneralKnowledgeBlock(generalKnowledge: string): string {
  if (generalKnowledge) {
    return `\n\n<general_context>\n${generalKnowledge}\n</general_context>`
  }
  return `\n\n<general_context>\nNo personal context provided. Use only the live transcript and screen.\n</general_context>`
}

function buildModeKnowledgeBlock(activeMode: ModeConfig): string {
  if (activeMode.id === 'meetings') {
    return buildWorkKnowledgeBlock(getWorkKnowledge())
  }
  if (activeMode.id === 'general') {
    return buildGeneralKnowledgeBlock(getGeneralKnowledge())
  }
  return ''
}

function buildMemoryBlock(queryText?: string): string {
  try {
    return getMemoryContextForPrompt({ queryText })
  } catch {
    return ''
  }
}

function buildGeneralAssistSystemPrompt(basePrompt: string, queryText?: string): string {
  const activeMode = getActiveMode()
  const knowledgeBlock = buildModeKnowledgeBlock(activeMode)
  const memoryBlock = buildMemoryBlock(queryText)
  const outputLanguageHint = getOutputLanguageInstruction()
  return `${basePrompt}\n\nActive mode:\n${activeMode.systemPrompt}${knowledgeBlock}${memoryBlock}${outputLanguageHint}`
}

function buildSalesAssistSystemPrompt(basePrompt: string, queryText?: string): string {
  const activeMode = getActiveMode()
  const productKnowledge = getProductKnowledge()
  const memoryBlock = buildMemoryBlock(queryText)
  const outputLanguageHint = getOutputLanguageInstruction()
  return `${basePrompt}\n\nActive mode:\n${activeMode.systemPrompt}${buildSalesKnowledgeBlock(productKnowledge)}${memoryBlock}${outputLanguageHint}`
}

async function requireSalesLlmConfig(): Promise<LlmCallConfig | SalesAssistError> {
  const llmConfig = await resolveSalesAssistLlmConfig()
  if (!llmConfig) {
    return {
      error: 'no_api_key',
      message:
        'Add ANTHROPIC_API_KEY to .env.local (or set a model API key in Settings → Models).',
    }
  }
  return llmConfig
}

function normalizeSingleAction(
  raw: Partial<SalesAssistAction> & { headline?: string } | undefined,
  fallbackKind: SalesCardKind,
): SalesAssistAction | null {
  if (!raw) return null
  return normalizeSalesAction({ ...raw, kind: raw.kind ?? fallbackKind })
}

export async function generateSalesAnswerAssist(
  transcriptLines: string[],
): Promise<{ answer?: SalesAssistAction; error?: SalesAssistError } | null> {
  if (isSalesAnswering) return null
  if (transcriptLines.length === 0) return null

  const tailLines = transcriptLines.slice(-30)
  const tail = tailLines.join('\n')
  const trigger = detectAnswerTrigger(tailLines)
  if (!trigger) return null
  if (trigger.key === lastAnswerTriggerKey && lastStickyAnswer) return null

  const llmResult = await requireSalesLlmConfig()
  if ('error' in llmResult) return { error: llmResult }

  isSalesAnswering = true
  try {
    const completion = await completeWithLlmConfig(
      llmResult,
      buildSalesAssistSystemPrompt(CLARIFI_SALES_ANSWER_PROMPT, tail),
      `Active moment (${trigger.kind}): ${trigger.summary}\n\nTranscript (most recent at bottom):\n${tail}`,
      500,
    )
    if (!completion.ok) {
      return { error: { error: 'assist_failed', message: completion.message } }
    }

    const parsed = parseJsonPayload<{
      action?: Partial<SalesAssistAction> & { headline?: string }
      actions?: Array<Partial<SalesAssistAction> & { headline?: string }>
    }>(completion.text)
    if (!parsed) {
      return {
        error: {
          error: 'assist_failed',
          message: 'Could not parse answer — try again in a few seconds.',
        },
      }
    }

    const action =
      normalizeSingleAction(parsed.action, trigger.kind === 'objection' ? 'objection' : 'product_info') ??
      collectSalesActions(parsed).find((item) => item.kind === 'product_info' || item.kind === 'objection') ??
      null

    if (!action) return null

    lastAnswerTriggerKey = trigger.key
    lastStickyAnswer = action
    return { answer: action }
  } catch (err) {
    console.error('Sales answer assist error:', err)
    return {
      error: {
        error: 'assist_failed',
        message: 'Assist error — check the terminal log or your API key.',
      },
    }
  } finally {
    isSalesAnswering = false
  }
}

export async function generateGeneralAnswerAssist(
  transcriptLines: string[],
): Promise<{ answer?: SalesAssistAction; error?: SalesAssistError } | null> {
  if (isGeneralAnswering) return null
  if (transcriptLines.length === 0) return null

  const tailLines = transcriptLines.slice(-30)
  const tail = tailLines.join('\n')
  const trigger = detectAnswerTrigger(tailLines)
  if (!trigger) return null
  if (trigger.key === lastGeneralAnswerTriggerKey && lastGeneralStickyAnswer) return null

  const llmResult = await requireSalesLlmConfig()
  if ('error' in llmResult) return { error: llmResult }

  isGeneralAnswering = true
  try {
    const completion = await completeWithLlmConfig(
      llmResult,
      buildGeneralAssistSystemPrompt(CLARIFI_GENERAL_ANSWER_PROMPT, tail),
      `Active moment (${trigger.kind}): ${trigger.summary}\n\nTranscript (most recent at bottom):\n${tail}`,
      500,
    )
    if (!completion.ok) {
      return { error: { error: 'assist_failed', message: completion.message } }
    }

    const parsed = parseJsonPayload<{
      action?: Partial<SalesAssistAction> & { headline?: string }
    }>(completion.text)
    if (!parsed) {
      return {
        error: {
          error: 'assist_failed',
          message: 'Could not parse answer — try again in a few seconds.',
        },
      }
    }

    const action = normalizeSingleAction(parsed.action, 'speak_now')
    if (!action) return null

    lastGeneralAnswerTriggerKey = trigger.key
    lastGeneralStickyAnswer = action
    return { answer: action }
  } catch (err) {
    console.error('General answer assist error:', err)
    return {
      error: {
        error: 'assist_failed',
        message: 'Assist error — check the terminal log or your API key.',
      },
    }
  } finally {
    isGeneralAnswering = false
  }
}

export async function generateSalesSuggestionAssist(
  transcriptLines: string[],
): Promise<{ suggestions?: SalesAssistAction[] } | null> {
  if (isSalesSuggesting) return null
  if (transcriptLines.length === 0) return null

  const tailLines = transcriptLines.slice(-30)
  const tail = tailLines.join('\n')
  const trigger = detectSuggestionTrigger(tailLines)
  if (!trigger) return null
  if (trigger.key === lastSuggestionTriggerKey && lastStickySuggestions.length > 0) return null

  const llmResult = await requireSalesLlmConfig()
  if ('error' in llmResult) return null

  isSalesSuggesting = true
  try {
    const completion = await completeWithLlmConfig(
      llmResult,
      buildSalesAssistSystemPrompt(CLARIFI_SALES_SUGGESTIONS_PROMPT, tail),
      `Active moment (${trigger.kind}): ${trigger.summary}\n\nTranscript (most recent at bottom):\n${tail}`,
      400,
    )
    if (!completion.ok) return null

    const parsed = parseJsonPayload<{
      suggestions?: Array<Partial<SalesAssistAction> & { headline?: string }>
      actions?: Array<Partial<SalesAssistAction> & { headline?: string }>
    }>(completion.text)
    if (!parsed) return null

    const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : parsed.actions ?? [])
      .map((item) => normalizeSalesAction(item))
      .filter((item): item is SalesAssistAction => item !== null)
      .filter((item) => item.kind !== 'product_info' && item.kind !== 'objection')
      .slice(0, 2)

    if (suggestions.length === 0) return null

    lastSuggestionTriggerKey = trigger.key
    lastStickySuggestions = suggestions
    return { suggestions }
  } catch (err) {
    console.error('Sales suggestion assist error:', err)
    return null
  } finally {
    isSalesSuggesting = false
  }
}

export async function generateSalesTermDefine(
  term: string,
  transcriptLines: string[],
): Promise<SalesDefineEntry | null> {
  const key = term.toLowerCase().trim()
  if (!key || definedTermsCache.has(key)) return null
  if (isSalesDefining) return null

  const llmResult = await requireSalesLlmConfig()
  if ('error' in llmResult) return null

  const tail = transcriptLines.slice(-30).join('\n')
  isSalesDefining = true
  try {
    const completion = await completeWithLlmConfig(
      llmResult,
      CLARIFI_SALES_DEFINE_PROMPT,
      `Term to define: ${term}\n\nRecent transcript:\n${tail}`,
      200,
    )
    if (!completion.ok) return null

    const parsed = parseJsonPayload<{
      term?: string
      speakable?: string
      context?: string
    }>(completion.text)
    const speakable = parsed?.speakable?.trim()
    if (!speakable) return null

    const entry: SalesDefineEntry = {
      term: parsed?.term?.trim() || term,
      speakable,
      context: parsed?.context?.trim() || undefined,
    }
    definedTermsCache.set(key, entry)
    return entry
  } catch (err) {
    console.error('Sales define error:', err)
    return null
  } finally {
    isSalesDefining = false
  }
}

export function getCachedSalesDefines(): SalesDefineEntry[] {
  return [...definedTermsCache.values()].slice(-3)
}

export function hasStickySalesAnswer(): boolean {
  return lastStickyAnswer !== null
}

export interface ScreenContextImage {
  imageBase64: string
  mimeType: 'image/png'
}

export interface ChatRequest {
  message: string
  transcriptLines: string[]
  useScreenContext: boolean
  screenImage?: ScreenContextImage
  emailContext?: string
}

export type ChatResult = { reply: string } | { error: string }

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image'
      source: { type: 'base64'; media_type: 'image/png'; data: string }
    }

export async function chatWithMeetingContext(
  request: ChatRequest,
): Promise<ChatResult> {
  const { message, transcriptLines, useScreenContext, screenImage, emailContext } = request

  if (useScreenContext && !screenImage) {
    return { error: 'capture_failed' }
  }

  const activeModel = getActiveModel()
  if (await isProxyConfigured() && activeModel.provider === 'anthropic' && activeModel.builtin) {
    return proxyChat(request)
  }

  const llmConfig = await resolveLlmCallConfig()
  if (!llmConfig) {
    console.error('LLM API key is not configured for the active model')
    return { error: 'api_key_missing' }
  }

  const activeMode = getActiveMode()

  const transcript =
    transcriptLines.length > 0
      ? transcriptLines.join('\n')
      : '(no transcript yet)'

  const screenStyleHint = screenImage
    ? '\n\nReply concisely using screen context reply style. No backticks. No em-dashes. Max 6 visible details bullets. Max 6 tab names. One summary sentence with **bold** key names only. Total response under 1200 characters for simple screen questions.'
    : ''

  const emailBlock = emailContext?.trim()
    ? `\n\nConnected Gmail context:\n${emailContext.trim()}`
    : ''

  const userText = screenImage
    ? `Live meeting transcript:\n${transcript}\n\nUser typed question:\n${message}${emailBlock}${screenStyleHint}`
    : `Live meeting transcript:\n${transcript}\n\nUser question:\n${message}${emailBlock}`

  const outputLanguageHint = getOutputLanguageInstruction()
  const knowledgeBlock = buildModeKnowledgeBlock(activeMode)
  const memoryBlock = buildMemoryBlock(message)
  const systemPrompt = screenImage
    ? `${activeMode.systemPrompt}${knowledgeBlock}${memoryBlock}\n\n${CLARIFI_ENTERPRISE_SYSTEM_PROMPT}${outputLanguageHint}`
    : `${activeMode.systemPrompt}${knowledgeBlock}${memoryBlock}${outputLanguageHint}`

  const userContent: AnthropicContentBlock[] = screenImage
    ? [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: screenImage.mimeType,
            data: screenImage.imageBase64,
          },
        },
        { type: 'text', text: userText },
      ]
    : [{ type: 'text', text: userText }]

  try {
    const reply = await completeWithActiveModel(systemPrompt, userContent, 2048)
    if (!reply) {
      return { error: 'empty_reply' }
    }

    return { reply }
  } catch (err) {
    console.error('Chat error:', err)
    return { error: 'chat_failed' }
  }
}

export async function generateSuggestions(
  transcriptLines: string[],
  playbook: string = '',
): Promise<Suggestion[]> {
  if (isProcessing) return []
  if (transcriptLines.length === 0) return []

  const transcript = transcriptLines.join('\n')
  if (transcript === lastTranscript) return []
  lastTranscript = transcript

  isProcessing = true

  try {
    const activeModel = getActiveModel()
    if (await isProxyConfigured() && activeModel.provider === 'anthropic' && activeModel.builtin) {
      return proxySuggest(transcriptLines, playbook)
    }

    const activeMode = getActiveMode()
    const outputLanguageHint = getOutputLanguageInstruction()
    const knowledgeBlock = buildModeKnowledgeBlock(activeMode)
    const memoryBlock = buildMemoryBlock(transcriptLines.slice(-8).join(' '))
    const systemPrompt = `${CLARIFI_SUGGESTIONS_SYSTEM_PROMPT}\n\nActive mode:\n${activeMode.systemPrompt}${knowledgeBlock}${memoryBlock}${outputLanguageHint}${playbook ? `\n\nUser context/playbook:\n${playbook}` : ''}`

    const text = await completeWithActiveModel(
      systemPrompt,
      `Live transcript:\n${transcript}\n\nSuggest what I should say next.`,
      300,
    )
    if (!text) return []

    const clean = text.replace(/```json|```/g, '').trim()
    const suggestions = JSON.parse(clean) as Suggestion[]
    return suggestions
  } catch (err) {
    console.error('Suggestion error:', err)
    return []
  } finally {
    isProcessing = false
  }
}

export async function analyzeLiveSession(
  transcriptLines: string[],
): Promise<LiveSessionInsights | null> {
  if (isAnalyzing) return null
  if (transcriptLines.length === 0) return null

  const transcript = transcriptLines.join('\n')
  if (transcript === lastAnalysisTranscript) return null
  lastAnalysisTranscript = transcript

  isAnalyzing = true

  try {
    const activeMode = getActiveMode()
    const outputLanguageHint = getOutputLanguageInstruction()
    const knowledgeBlock = buildModeKnowledgeBlock(activeMode)
    const systemPrompt = `${CLARIFI_SESSION_ANALYSIS_PROMPT}\n\nActive mode:\n${activeMode.systemPrompt}${knowledgeBlock}${outputLanguageHint}`

    const text = await completeWithActiveModel(
      systemPrompt,
      `Live meeting transcript:\n${transcript}`,
      800,
    )
    if (!text) return null

    const parsed = parseJsonPayload<LiveSessionInsights>(text)
    if (!parsed) return null

    return {
      meetingIntro: parsed.meetingIntro ?? '',
      runningSummary: parsed.runningSummary ?? parsed.meetingIntro ?? '',
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      sentiment: parsed.sentiment ?? 'neutral',
      keyMoments: Array.isArray(parsed.keyMoments) ? parsed.keyMoments : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions : [],
    }
  } catch (err) {
    console.error('Session analysis error:', err)
    return null
  } finally {
    isAnalyzing = false
  }
}

const SALES_CARD_KINDS: SalesCardKind[] = [
  'speak_now',
  'technical_lookup',
  'objection',
  'product_info',
  'discovery',
  'next_step',
]

function normalizeSalesKind(kind: unknown): SalesCardKind {
  return SALES_CARD_KINDS.includes(kind as SalesCardKind) ? (kind as SalesCardKind) : 'speak_now'
}

function defaultActionLabel(kind: SalesCardKind, headline: string): string {
  const h = headline.trim() || 'this'
  switch (kind) {
    case 'technical_lookup':
      return h.toLowerCase().startsWith('define ') ? h : `Define ${h}`
    case 'product_info':
      return h.toLowerCase().startsWith('answer') ? h : `Answer: ${h}`
    case 'objection':
      return h.toLowerCase().startsWith('rebuttal') ? h : `Rebuttal: ${h}`
    default:
      return h
  }
}

function normalizeSalesAction(
  raw: Partial<SalesAssistAction> & { headline?: string },
  loose = false,
): SalesAssistAction | null {
  if (!raw) return null
  const speakable =
    typeof raw.speakable === 'string' && raw.speakable.trim()
      ? raw.speakable.trim()
      : loose && typeof raw.context === 'string' && raw.context.trim().length > 12
        ? raw.context.trim()
        : ''
  if (!speakable) return null
  const kind = normalizeSalesKind(raw.kind)
  const headline =
    typeof raw.label === 'string' && raw.label.trim()
      ? raw.label.trim()
      : typeof raw.headline === 'string' && raw.headline.trim()
        ? raw.headline.trim()
        : ''
  const label = headline ? defaultActionLabel(kind, headline) : defaultActionLabel(kind, 'Say this now')
  return {
    kind,
    label,
    speakable,
    context:
      typeof raw.context === 'string' && raw.context.trim() && raw.context.trim() !== speakable
        ? raw.context.trim()
        : undefined,
  }
}

function collectSalesActions(parsed: {
  actions?: Array<Partial<SalesAssistAction> & { headline?: string }>
  primaryCard?: Partial<SalesAssistAction> & { headline?: string }
  secondaryCards?: Array<Partial<SalesAssistAction> & { headline?: string }>
}): SalesAssistAction[] {
  const fromActions = (Array.isArray(parsed.actions) ? parsed.actions : [])
    .map((item) => normalizeSalesAction(item))
    .filter((item): item is SalesAssistAction => item !== null)

  if (fromActions.length > 0) return fromActions.slice(0, 5)

  const legacy = [
    parsed.primaryCard,
    ...(Array.isArray(parsed.secondaryCards) ? parsed.secondaryCards : []),
  ]
    .map((item) => normalizeSalesAction(item ?? {}))
    .filter((item): item is SalesAssistAction => item !== null)

  if (legacy.length > 0) return legacy.slice(0, 5)

  const looseSources = [
    ...(Array.isArray(parsed.actions) ? parsed.actions : []),
    parsed.primaryCard,
    ...(Array.isArray(parsed.secondaryCards) ? parsed.secondaryCards : []),
  ]
  const loose = looseSources
    .map((item) => normalizeSalesAction(item ?? {}, true))
    .filter((item): item is SalesAssistAction => item !== null)

  return loose.slice(0, 5)
}

function buildSalesKnowledgeBlock(productKnowledge: string): string {
  if (productKnowledge) {
    return `\n\n<product_knowledge>\n${productKnowledge}\n</product_knowledge>`
  }
  return `\n\n<product_knowledge>\nNo product knowledge provided. Infer product details ONLY from the transcript. Do not invent features or pricing not discussed.\n</product_knowledge>`
}

function normalizeSessionRecap(parsed: SessionRecap): SessionRecap {
  const discussionPoints = Array.isArray(parsed.discussionPoints)
    ? parsed.discussionPoints
    : Array.isArray(parsed.highlights)
      ? parsed.highlights
      : []

  const prospectFollowUp =
    typeof parsed.prospectFollowUpEmail === 'string' && parsed.prospectFollowUpEmail.trim()
      ? parsed.prospectFollowUpEmail.trim()
      : undefined

  const recapEmailDraft =
    typeof parsed.recapEmailDraft === 'string' && parsed.recapEmailDraft.trim()
      ? parsed.recapEmailDraft.trim()
      : (prospectFollowUp ?? '')

  const objectionsRaised = Array.isArray(parsed.objectionsRaised)
    ? parsed.objectionsRaised
        .filter(
          (o) =>
            o &&
            typeof o === 'object' &&
            typeof (o as SalesObjectionRecap).summary === 'string',
        )
        .map((o) => ({
          type: typeof o.type === 'string' ? o.type : 'other',
          summary: o.summary,
          handled: typeof o.handled === 'string' ? o.handled : 'unresolved',
        }))
    : undefined

  return {
    summary: parsed.summary ?? '',
    highlights: discussionPoints,
    discussionPoints,
    actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions : [],
    recapEmailDraft,
    dealSummary: typeof parsed.dealSummary === 'string' ? parsed.dealSummary : undefined,
    painPointsUncovered: Array.isArray(parsed.painPointsUncovered)
      ? parsed.painPointsUncovered
      : undefined,
    objectionsRaised,
    competitorsMentioned: Array.isArray(parsed.competitorsMentioned)
      ? parsed.competitorsMentioned
      : undefined,
    budgetTimelineSignals: Array.isArray(parsed.budgetTimelineSignals)
      ? parsed.budgetTimelineSignals
      : undefined,
    buyingSignals: Array.isArray(parsed.buyingSignals) ? parsed.buyingSignals : undefined,
    stakeholderMap: Array.isArray(parsed.stakeholderMap) ? parsed.stakeholderMap : undefined,
    riskFlags: Array.isArray(parsed.riskFlags) ? parsed.riskFlags : undefined,
    mutualActionPlan: Array.isArray(parsed.mutualActionPlan)
      ? parsed.mutualActionPlan
      : undefined,
    nextCallAgenda: Array.isArray(parsed.nextCallAgenda) ? parsed.nextCallAgenda : undefined,
    prospectFollowUpEmail: prospectFollowUp,
    internalCrmNote:
      typeof parsed.internalCrmNote === 'string' ? parsed.internalCrmNote : undefined,
  }
}

export async function generateSessionRecap(
  transcriptLines: string[],
): Promise<SessionRecap | null> {
  if (transcriptLines.length === 0) return null

  const transcript = transcriptLines.join('\n')
  const outputLanguageHint = getOutputLanguageInstruction()
  const activeMode = getActiveMode()
  const isSales = activeMode.id === 'sales'
  const productKnowledge = getProductKnowledge()

  const systemPrompt = isSales
    ? `${CLARIFI_SALES_SESSION_RECAP_PROMPT}${buildSalesKnowledgeBlock(productKnowledge)}${outputLanguageHint}`
    : `${CLARIFI_SESSION_RECAP_PROMPT}${outputLanguageHint}`

  try {
    const text = await completeWithActiveModel(
      systemPrompt,
      `Full meeting transcript:\n${transcript}`,
      isSales ? 1600 : 1200,
    )
    if (!text) return null

    const parsed = parseJsonPayload<SessionRecap>(text)
    if (!parsed) return null

    return normalizeSessionRecap(parsed)
  } catch (err) {
    console.error('Session recap error:', err)
    return null
  }
}

export async function inferSpeakerLabels(
  entries: TranscriptEntry[],
): Promise<SpeakerLabels> {
  const diarized = collectDiarizedSpeakers(entries)
  if (diarized.length === 0) return {}

  const transcript = entriesToLines(entries).join('\n')
  const outputLanguageHint = getOutputLanguageInstruction()
  const systemPrompt = `${CLARIFI_SPEAKER_INFERENCE_PROMPT}${outputLanguageHint}`

  try {
    const text = await completeWithActiveModel(
      systemPrompt,
      `Group call transcript:\n${transcript}`,
      400,
    )
    if (!text) return {}

    const parsed = parseJsonPayload<{ labels?: SpeakerLabels }>(text)
    const labels = parsed?.labels
    if (!labels || typeof labels !== 'object') return {}

    const result: SpeakerLabels = {}
    for (const speaker of diarized) {
      const value = labels[speaker]
      if (typeof value === 'string' && value.trim()) {
        result[speaker] = value.trim().slice(0, 48)
      }
    }
    return result
  } catch (err) {
    console.error('Speaker inference error:', err)
    return {}
  }
}

export async function chatWithStoredAudioSession(
  message: string,
  transcriptLines: string[],
  recap: SessionRecap | null,
  speakerLabels?: SpeakerLabels,
): Promise<ChatResult> {
  const transcript =
    transcriptLines.length > 0 ? transcriptLines.join('\n') : '(empty transcript)'

  const discussionPoints =
    recap?.discussionPoints?.length > 0 ? recap.discussionPoints : recap?.highlights ?? []

  const recapBlock = recap
    ? [
        `Summary: ${recap.summary}`,
        recap.dealSummary ? `Deal summary: ${recap.dealSummary}` : '',
        discussionPoints.length > 0
          ? `Discussion points: ${discussionPoints.join('; ')}`
          : '',
        (recap.painPointsUncovered?.length ?? 0) > 0
          ? `Pain points: ${recap.painPointsUncovered!.join('; ')}`
          : '',
        (recap.objectionsRaised?.length ?? 0) > 0
          ? `Objections: ${recap.objectionsRaised!.map((o) => `${o.type}: ${o.summary}`).join('; ')}`
          : '',
        (recap.mutualActionPlan?.length ?? 0) > 0
          ? `Mutual action plan: ${recap.mutualActionPlan!.join('; ')}`
          : '',
        recap.actionItems.length > 0 ? `Action items: ${recap.actionItems.join('; ')}` : '',
        (recap.decisions?.length ?? 0) > 0
          ? `Decisions: ${recap.decisions!.join('; ')}`
          : '',
        recap.openQuestions.length > 0 ? `Open questions: ${recap.openQuestions.join('; ')}` : '',
        recap.internalCrmNote ? `CRM note: ${recap.internalCrmNote}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '(no recap generated)'

  const outputLanguageHint = getOutputLanguageInstruction()
  const systemPrompt = `${CLARIFI_AUDIO_SESSION_CHAT_PROMPT}${outputLanguageHint}`
  const userText = `Meeting recap:\n${recapBlock}\n\nFull transcript:\n${transcript}\n\nUser question:\n${message}`

  try {
    const reply = await completeWithActiveModel(systemPrompt, userText, 1024)
    if (!reply) {
      return { error: 'empty_reply' }
    }
    return { reply }
  } catch (err) {
    console.error('Audio session chat error:', err)
    return { error: 'chat_failed' }
  }
}
