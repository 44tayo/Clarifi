/**
 * Languages supported by Whisper large-v3 (used by Groq for transcription)
 * and Deepgram nova-3 diarization. This is the same ~99-language set Whisper
 * itself documents support for — used both for the transcription/dictation
 * "spoken language" picker and the notes/dictation "output language" picker
 * (the latter is limited only by the LLM's own language fluency, which
 * covers all of these comfortably).
 */
export const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  zh: 'Chinese',
  de: 'German',
  es: 'Spanish',
  ru: 'Russian',
  ko: 'Korean',
  fr: 'French',
  ja: 'Japanese',
  pt: 'Portuguese',
  tr: 'Turkish',
  pl: 'Polish',
  ca: 'Catalan',
  nl: 'Dutch',
  ar: 'Arabic',
  sv: 'Swedish',
  it: 'Italian',
  id: 'Indonesian',
  hi: 'Hindi',
  fi: 'Finnish',
  vi: 'Vietnamese',
  he: 'Hebrew',
  uk: 'Ukrainian',
  el: 'Greek',
  ms: 'Malay',
  cs: 'Czech',
  ro: 'Romanian',
  da: 'Danish',
  hu: 'Hungarian',
  ta: 'Tamil',
  no: 'Norwegian',
  th: 'Thai',
  ur: 'Urdu',
  hr: 'Croatian',
  bg: 'Bulgarian',
  lt: 'Lithuanian',
  la: 'Latin',
  mi: 'Maori',
  ml: 'Malayalam',
  cy: 'Welsh',
  sk: 'Slovak',
  te: 'Telugu',
  fa: 'Persian',
  lv: 'Latvian',
  bn: 'Bengali',
  sr: 'Serbian',
  az: 'Azerbaijani',
  sl: 'Slovenian',
  kn: 'Kannada',
  et: 'Estonian',
  mk: 'Macedonian',
  br: 'Breton',
  eu: 'Basque',
  is: 'Icelandic',
  hy: 'Armenian',
  ne: 'Nepali',
  mn: 'Mongolian',
  bs: 'Bosnian',
  kk: 'Kazakh',
  sq: 'Albanian',
  sw: 'Swahili',
  gl: 'Galician',
  mr: 'Marathi',
  pa: 'Punjabi',
  si: 'Sinhala',
  km: 'Khmer',
  sn: 'Shona',
  yo: 'Yoruba',
  so: 'Somali',
  af: 'Afrikaans',
  oc: 'Occitan',
  ka: 'Georgian',
  be: 'Belarusian',
  tg: 'Tajik',
  sd: 'Sindhi',
  gu: 'Gujarati',
  am: 'Amharic',
  yi: 'Yiddish',
  lo: 'Lao',
  uz: 'Uzbek',
  fo: 'Faroese',
  ht: 'Haitian Creole',
  ps: 'Pashto',
  tk: 'Turkmen',
  nn: 'Norwegian Nynorsk',
  mt: 'Maltese',
  sa: 'Sanskrit',
  lb: 'Luxembourgish',
  my: 'Myanmar (Burmese)',
  bo: 'Tibetan',
  tl: 'Tagalog',
  mg: 'Malagasy',
  as: 'Assamese',
  tt: 'Tatar',
  haw: 'Hawaiian',
  ln: 'Lingala',
  ha: 'Hausa',
  ba: 'Bashkir',
  jw: 'Javanese',
  su: 'Sundanese',
  yue: 'Cantonese',
}

export type LanguageOption = { code: string; label: string }

/** Sorted A→Z by display label, for dropdowns. */
export const LANGUAGE_OPTIONS: LanguageOption[] = Object.entries(LANGUAGE_LABELS)
  .map(([code, label]) => ({ code, label }))
  .sort((a, b) => a.label.localeCompare(b.label))

/** Transcription/dictation "spoken language" pickers also offer auto-detect. */
export const SPOKEN_LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'auto', label: 'Auto-detect' },
  ...LANGUAGE_OPTIONS,
]

export function languageLabel(code: string): string {
  return LANGUAGE_LABELS[code] ?? code
}
