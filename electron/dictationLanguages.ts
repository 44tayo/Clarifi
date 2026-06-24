export type DictationLanguageOption = {
  code: string
  label: string
}

export const DICTATION_LANGUAGES: DictationLanguageOption[] = [
  { code: 'auto', label: 'Auto-detect (recommended for accents)' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
  { code: 'pl', label: 'Polish' },
  { code: 'tr', label: 'Turkish' },
  { code: 'ru', label: 'Russian' },
  { code: 'sv', label: 'Swedish' },
]

export const DICTATION_OUTPUT_LANGUAGES: DictationLanguageOption[] = [
  { code: 'same', label: 'Same as spoken language' },
  ...DICTATION_LANGUAGES.filter((lang) => lang.code !== 'auto'),
]

export function dictationLanguageLabel(code: string): string {
  return DICTATION_LANGUAGES.find((lang) => lang.code === code)?.label ?? code
}

/** Intentionally empty — Whisper prompts on short clips cause hallucinated echo text. */
export function dictationWhisperPrompt(_code: string): string | undefined {
  return undefined
}

export function dictationLanguageName(code: string): string {
  if (code === 'same' || code === 'auto') return 'the spoken language'
  return dictationLanguageLabel(code)
}
