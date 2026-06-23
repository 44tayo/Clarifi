import { getDictationLanguage, getDictationOutputLanguageInstruction } from './audioPreferences'
import { dictationLanguageName, dictationWhisperPrompt } from './dictationLanguages'
import { transcribeDictationAudio } from './audio'
import { completeProactiveText } from './proactive/proactiveLlm'
import {
  dictationSurfaceLabel,
  inferDictationSurface,
} from './proactive/textExtraction'
import {
  insertTextIntoExternalField,
  isClarifiProcess,
} from './dictationInsert'

function buildDictationPrompt(spokenLanguage: string, surface?: string): string {
  const languageLine =
    spokenLanguage === 'auto'
      ? 'Preserve the speaker\'s language exactly as spoken (auto-detect). Do not translate unless explicitly requested.'
      : `Preserve ${dictationLanguageName(spokenLanguage)}. Do not translate into English unless explicitly requested.`

  const surfaceRules =
    surface === 'email'
      ? `- Email surface: structure as a proper email when content warrants it — clear paragraphs, professional tone, greeting and sign-off only if the speaker included them or clearly implied a full message.
- Fix run-on sentences; keep names, dates, and numbers exactly as spoken.`
      : surface === 'chat'
        ? `- Chat surface: keep lines short and conversational; one thought per line when the speaker pauses.
- Preserve casual tone; do not over-formalize.`
        : surface === 'code'
          ? `- Code surface: preserve indentation and line breaks; keep identifiers, operators, and syntax literal.
- Only format as a fenced code block if the speaker clearly dictated code structure.`
          : `- Match the tone of the target app (email, chat, or document) without inventing structure the speaker did not imply.`

  return `You turn casual spoken dictation into clean text ready to insert into the user's active text field.

Return ONLY the final text — no quotes, markdown fences, labels, or explanation.

Rules:
- ${languageLine}
- Remove filler words (um, uh, like, you know), false starts, and repeated fragments; preserve intent and every substantive detail.
- Apply proper punctuation, capitalization, and sentence boundaries for the target language.
- Self-correction: if the speaker revises themselves ("no wait", "I mean"), output ONLY the final intended wording.
${surfaceRules}
- Do not invent facts, names, or commitments the speaker did not say.
- When unsure between two phrasings, prefer the more precise and grammatically correct reading.`
}

export type DictationTarget = 'auto' | 'overlay' | 'focused_field'

export type DictationComposeResult = {
  text?: string
  error?: string
  destination?: 'overlay' | 'focused_field'
  insertMethod?: 'accessibility' | 'paste'
  targetApp?: string | null
  surfaceLabel?: string
  clipboardFallback?: boolean
}

function resolveDestinationForApp(
  target: DictationTarget,
  targetApp?: string | null,
): 'overlay' | 'focused_field' {
  if (target === 'overlay') return 'overlay'
  if (target === 'focused_field') return 'focused_field'
  if (targetApp && !isClarifiProcess(targetApp)) return 'focused_field'
  return 'overlay'
}

function resolveSurfaceHint(targetApp?: string | null): string {
  const surface = inferDictationSurface(targetApp)
  return `Target surface: ${surface} (${dictationSurfaceLabel(surface)}). Active app: ${targetApp ?? 'unknown'}.`
}

function shouldSkipPolish(raw: string, spokenLanguage: string): boolean {
  if (spokenLanguage !== 'auto') return false
  const trimmed = raw.trim()
  if (trimmed.length < 8) return true
  if (/^(um|uh|ehm|hmm)[\s,.!?-]*$/i.test(trimmed)) return true
  return false
}

export async function composeDictationFromAudio(
  audioBase64: string,
  options: { target?: DictationTarget; targetApp?: string | null } = {},
): Promise<DictationComposeResult> {
  const spokenLanguage = getDictationLanguage()
  const whisperPrompt = dictationWhisperPrompt(spokenLanguage)
  const targetApp = options.targetApp ?? null
  const surface = inferDictationSurface(targetApp)
  const surfaceHint = resolveSurfaceHint(targetApp)
  const outputInstruction = getDictationOutputLanguageInstruction(spokenLanguage)
  const destination = resolveDestinationForApp(options.target ?? 'auto', targetApp)
  const surfaceLabel = dictationSurfaceLabel(surface)

  const raw = await transcribeDictationAudio(audioBase64, {
    source: 'mic',
    language: spokenLanguage,
    prompt: whisperPrompt,
  })
  if (!raw?.trim()) {
    return { error: 'no_speech' }
  }

  let text = raw.trim()
  if (!shouldSkipPolish(raw, spokenLanguage)) {
    const polished = await completeProactiveText(
      buildDictationPrompt(spokenLanguage, surface) + outputInstruction,
      `${surfaceHint}\n\nSpoken dictation (verbatim transcript):\n${raw.trim()}`,
      1200,
    )
    text = polished?.trim() || raw.trim()
  }

  if (destination === 'overlay') {
    return { text, destination: 'overlay', surfaceLabel }
  }

  const insert = await insertTextIntoExternalField(text, targetApp)
  if (insert.ok) {
    return {
      text,
      destination: 'focused_field',
      insertMethod: insert.method,
      targetApp: insert.targetApp,
      surfaceLabel,
    }
  }

  if (insert.error === 'accessibility_required') {
    return {
      text,
      error: 'accessibility_required',
      destination: 'overlay',
      surfaceLabel,
    }
  }

  if (insert.error === 'no_target_app') {
    return { text, destination: 'overlay', surfaceLabel }
  }

  return {
    text,
    error: 'insert_failed',
    destination: 'overlay',
    surfaceLabel,
    clipboardFallback: insert.clipboardFallback,
  }
}

export { startDictationTargetTracking } from './dictationInsert'
