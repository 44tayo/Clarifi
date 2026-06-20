import { transcribeDictationAudio } from './audio'
import { completeProactiveText } from './proactive/proactiveLlm'
import {
  gatherProactiveContext,
  getFrontmostAppName,
} from './proactive/textExtraction'
import {
  getDictationTargetApp,
  insertTextIntoExternalField,
  isClarifiProcess,
  trackExternalFrontmostApp,
} from './dictationInsert'

const CLARIFI_DICTATION_PROMPT = `You turn casual spoken dictation into clean text ready to insert into the user's active text field.

Return ONLY the final text — no quotes, markdown fences, labels, or explanation.

Rules:
- Remove filler words and false starts; preserve intent and key details.
- If the user is in email compose (Gmail, Mail, Outlook), write a proper email body — not a chat reply.
- If the user is in chat or messaging (Slack, iMessage, Teams), keep it concise and natural.
- If the user is in a document or notes app, use clear prose paragraphs.
- If context is unclear, return polished plain text suitable for a general text input.
- Do not invent facts the speaker did not say.`

export type DictationTarget = 'auto' | 'overlay' | 'focused_field'

export type DictationComposeResult = {
  text?: string
  error?: string
  destination?: 'overlay' | 'focused_field'
  insertMethod?: 'accessibility' | 'paste'
  targetApp?: string | null
}

function resolveDestination(target: DictationTarget): 'overlay' | 'focused_field' {
  if (target === 'overlay') return 'overlay'
  if (target === 'focused_field') return 'focused_field'

  trackExternalFrontmostApp()
  const front = getFrontmostAppName()
  if (front && !isClarifiProcess(front)) return 'focused_field'
  const external = getDictationTargetApp()
  if (external && !isClarifiProcess(external)) return 'focused_field'
  return 'overlay'
}

export async function composeDictationFromAudio(
  audioBase64: string,
  options: { target?: DictationTarget; targetApp?: string | null } = {},
): Promise<DictationComposeResult> {
  const raw = await transcribeDictationAudio(audioBase64, { source: 'mic' })
  if (!raw?.trim()) {
    return { error: 'no_speech' }
  }

  const ctx = await gatherProactiveContext({ includeScreenAnalysis: false })
  const contextBlock = ctx.combinedText.trim()
    ? `\n\nVisible context:\n${ctx.combinedText.slice(0, 6000)}`
    : ''

  const polished = await completeProactiveText(
    CLARIFI_DICTATION_PROMPT,
    `Spoken dictation (verbatim transcript):\n${raw.trim()}${contextBlock}`,
    1200,
  )

  const text = (polished?.trim() || raw.trim())
  const destination = resolveDestination(options.target ?? 'auto')

  if (destination === 'overlay') {
    return { text, destination: 'overlay' }
  }

  const insert = insertTextIntoExternalField(text, options.targetApp ?? getDictationTargetApp())
  if (insert.ok) {
    return {
      text,
      destination: 'focused_field',
      insertMethod: insert.method,
      targetApp: insert.targetApp,
    }
  }

  if (insert.error === 'accessibility_required') {
    return {
      text,
      error: 'accessibility_required',
      destination: 'overlay',
    }
  }

  if (insert.error === 'no_target_app') {
    return { text, destination: 'overlay' }
  }

  return {
    text,
    error: 'insert_failed',
    destination: 'overlay',
  }
}
