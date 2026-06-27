import { getDictationLanguage, getDictationOutputLanguageInstruction } from './audioPreferences'
import { dictationLanguageName } from './dictationLanguages'
import { transcribeDictationAudio } from './audio'
import { completeDictationTextFast } from './proactive/proactiveLlm'
import { DICTATION_POLISH_MAX_OUTPUT_TOKENS } from './proactive/featureTypes'
import {
  dictationSurfaceLabel,
  inferDictationSurface,
} from './proactive/textExtraction'
import {
  insertTextIntoExternalField,
  isClarifiProcess,
  preactivateDictationTarget,
  type DictationTargetSnapshot,
} from './dictationInsert'
import { isLikelyHallucination, normalizeForCompare } from './transcriptUtils'

/** Per-app tone, casing, and formatting guidance (adapted from WsprFlow's context map). */
function surfaceRulesFor(surface?: string): string {
  switch (surface) {
    case 'email':
      return `- Email surface: professional tone with clear paragraphs when the speaker dictated a full message.
- Proper grammar and capitalization. Greeting and sign-off only if the speaker said them — never invent either.
- Fix run-on sentences; keep names, dates, and numbers exactly as spoken.`
    case 'chat':
      return `- Chat/messaging surface (Slack, Discord, Teams, Messages): casual, conversational tone with relaxed capitalization.
- Keep lines short; one thought per line when the speaker pauses. Do not over-formalize.`
    case 'code':
      return `- Code editor surface (Cursor, VS Code, IDEs): technical, concise, code-friendly.
- Prefix a "@" before any file mention so it is clickable in the IDE (e.g. "index.ts" -> "@index.ts", "main.py" -> "@main.py"). Covers common extensions like .ts, .tsx, .js, .py, .go, .rs, .java, .cpp, .css, .html, .json, .md.
- Preserve indentation and line breaks; keep identifiers, operators, and syntax literal.
- Only format as a fenced code block if the speaker clearly dictated code structure.`
    case 'terminal':
      return `- Terminal/command-line surface: technical and terse.
- Prefer lowercase for commands, flags, and paths; keep them literal and do not add trailing punctuation to a command.`
    case 'browser':
      return `- Browser surface: adapt to the content — casual for social/chat sites, professional for work or formal sites.
- Output a single flowing message unless the speaker clearly dictated structure.`
    case 'document':
      return `- Document surface (Notes, Notion, Docs, Word): well-structured, properly punctuated paragraphs.
- Use lists or headings only when the speaker clearly dictated them.`
    default:
      return `- Output a single flowing paragraph unless the speaker clearly dictated a list or multiple distinct points.
- Match the tone of the target app without inventing structure the speaker did not imply.`
  }
}

function buildDictationPrompt(spokenLanguage: string, surface?: string): string {
  const languageLine =
    spokenLanguage === 'auto'
      ? 'Preserve the speaker\'s language exactly as spoken (auto-detect). Do not translate unless explicitly requested.'
      : `Preserve ${dictationLanguageName(spokenLanguage)}. Do not translate into English unless explicitly requested.`

  const surfaceRules = surfaceRulesFor(surface)

  return `You turn casual spoken dictation into clean text ready to insert into the user's active text field.

Return ONLY the final text — no quotes, markdown fences, labels, or explanation.

Rules:
- ${languageLine}
- Fidelity: every content word in your output must come from the verbatim transcript. Do not continue, complete, or merge with any existing field text — only the newly spoken words.
- Remove filler words (um, uh, like, you know), false starts, and repeated fragments; preserve intent and every substantive detail.
- Apply proper punctuation, capitalization, and sentence boundaries for the target language.
- Self-correction: if the speaker revises themselves ("no wait", "I mean"), output ONLY the final intended wording.
- When unsure between two phrasings, prefer the transcript wording over guessing.
${surfaceRules}
- Do not invent facts, names, or commitments the speaker did not say.
- Do not add content the user did not say.`
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

function resolveSurfaceHint(
  targetApp?: string | null,
  snapshot?: DictationTargetSnapshot | null,
): string {
  const surface = inferDictationSurface(targetApp)
  const lines = [
    `Target surface: ${surface} (${dictationSurfaceLabel(surface)}). Active app: ${targetApp ?? 'unknown'}.`,
    'Do not continue or reply to any existing text in the field — output only what was spoken in this clip.',
  ]
  if (snapshot?.windowTitle) {
    lines.push(`Window title: ${snapshot.windowTitle}.`)
  }
  return lines.join(' ')
}

function stripSpokenFillers(text: string): string {
  let out = text
  out = out.replace(/\b(u+h+h*|u+m+m*h*|e+h+m+|e+r+m+|h+m+)\b/gi, '')
  out = out.replace(/\b(the\s+){2,}/gi, 'the ')
  out = out.replace(/\s+/g, ' ').trim()
  out = out.replace(/\s+([,.!?;:])/g, '$1')
  return out
}

function normalizeDictationOutput(text: string): string {
  let out = text.trim()
  if (
    (out.startsWith('"') && out.endsWith('"')) ||
    (out.startsWith("'") && out.endsWith("'"))
  ) {
    out = out.slice(1, -1).trim()
  }
  out = out.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()
  out = out.replace(/^(output|result|dictation):\s*/i, '').trim()
  out = stripSpokenFillers(out)
  return out
}

function contentWords(text: string): Set<string> {
  return new Set(
    normalizeForCompare(text)
      .split(' ')
      .filter((word) => word.length >= 3),
  )
}

function polishDriftedTooFar(raw: string, polished: string): boolean {
  const rawWords = contentWords(raw)
  const polishedWords = contentWords(polished)
  if (polishedWords.size === 0) return true
  if (rawWords.size === 0) return false

  let newWords = 0
  polishedWords.forEach((word) => {
    if (!rawWords.has(word)) newWords += 1
  })

  const newRatio = newWords / polishedWords.size
  const lengthRatio = polished.length / Math.max(raw.length, 1)
  return newRatio > 0.35 || lengthRatio > 2.5
}

function looksAlreadyClean(trimmed: string): boolean {
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length > 8 || words.length < 3) return false
  const hasEndPunct = /[.!?]$/.test(trimmed)
  const startsCapital = /^[A-ZÀ-ÖØ-Þ]/.test(trimmed)
  const lowFiller = !/\b(u+m+h*|u+h+h*|ehm|hmm)\b/i.test(trimmed)
  return hasEndPunct && startsCapital && lowFiller
}

function shouldSkipPolish(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed) return true
  if (/^(um|uh|ehm|hmm)[\s,.!?-]*$/i.test(trimmed)) return true
  if (looksAlreadyClean(trimmed)) return true
  const words = trimmed.split(/\s+/).filter(Boolean)
  return words.length < 3
}

/** Hard floor — clips shorter than this almost never contain real speech. */
const MIN_DICTATION_DURATION_MS = 400

export async function composeDictationFromAudio(
  audioBase64: string,
  options: {
    target?: DictationTarget
    targetApp?: string | null
    targetSnapshot?: DictationTargetSnapshot | null
    durationMs?: number
    hasSpeech?: boolean
  } = {},
): Promise<DictationComposeResult> {
  // Renderer-side voice-activity gates: reject silence before any transcription.
  if (options.hasSpeech === false) {
    return { error: 'no_speech' }
  }
  if (
    typeof options.durationMs === 'number' &&
    options.durationMs > 0 &&
    options.durationMs < MIN_DICTATION_DURATION_MS
  ) {
    return { error: 'no_speech' }
  }

  const spokenLanguage = getDictationLanguage()
  const targetApp = options.targetSnapshot?.app ?? options.targetApp ?? null
  const surface = inferDictationSurface(targetApp)
  const surfaceHint = resolveSurfaceHint(targetApp, options.targetSnapshot)
  const outputInstruction = getDictationOutputLanguageInstruction(spokenLanguage)
  const destination = resolveDestinationForApp(options.target ?? 'auto', targetApp)
  const surfaceLabel = dictationSurfaceLabel(surface)
  const insertTarget = options.targetSnapshot ?? targetApp
  const willInsert = destination === 'focused_field'
  let preactivated = false

  const raw = await transcribeDictationAudio(audioBase64, {
    source: 'mic',
    language: spokenLanguage,
  })
  const trimmedRaw = raw?.trim() ?? ''
  if (!trimmedRaw || isLikelyHallucination(trimmedRaw, 'mic')) {
    return { error: 'no_speech' }
  }

  const preactivatePromise = willInsert
    ? Promise.resolve().then(() => {
        preactivated = preactivateDictationTarget(insertTarget) !== null
      })
    : Promise.resolve()

  const polishPromise = !shouldSkipPolish(trimmedRaw)
    ? completeDictationTextFast(
        buildDictationPrompt(spokenLanguage, surface) + outputInstruction,
        `${surfaceHint}\n\nSpoken dictation (verbatim transcript):\n${trimmedRaw}`,
        DICTATION_POLISH_MAX_OUTPUT_TOKENS,
      )
    : Promise.resolve(null)

  const [, polished] = await Promise.all([preactivatePromise, polishPromise])

  let text = trimmedRaw
  if (polished?.trim()) {
    const candidate = normalizeDictationOutput(polished.trim())
    text = polishDriftedTooFar(trimmedRaw, candidate) ? normalizeDictationOutput(trimmedRaw) : candidate
  } else {
    text = normalizeDictationOutput(trimmedRaw)
  }

  if (destination === 'overlay') {
    return { text, destination: 'overlay', surfaceLabel }
  }

  const insert = await insertTextIntoExternalField(text, insertTarget, {
    skipActivate: preactivated,
  })
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
