export type DictationLanguageOption = {
  code: string
  label: string
  whisperPrompt?: string
}

export const DICTATION_LANGUAGES: DictationLanguageOption[] = [
  { code: 'auto', label: 'Auto-detect (recommended for accents)' },
  { code: 'en', label: 'English', whisperPrompt: 'Hello, thanks, meeting, email.' },
  { code: 'es', label: 'Spanish', whisperPrompt: 'Hola, gracias, reunión, correo.' },
  { code: 'fr', label: 'French', whisperPrompt: 'Bonjour, merci, réunion, email.' },
  { code: 'de', label: 'German', whisperPrompt: 'Hallo, danke, Meeting, E-Mail.' },
  { code: 'pt', label: 'Portuguese', whisperPrompt: 'Olá, obrigado, reunião, email.' },
  { code: 'it', label: 'Italian', whisperPrompt: 'Ciao, grazie, riunione, email.' },
  { code: 'nl', label: 'Dutch', whisperPrompt: 'Hallo, dank je, vergadering, email.' },
  { code: 'ja', label: 'Japanese', whisperPrompt: 'こんにちは、ありがとう、会議、メール。' },
  { code: 'ko', label: 'Korean', whisperPrompt: '안녕하세요, 감사합니다, 회의, 이메일.' },
  { code: 'zh', label: 'Chinese', whisperPrompt: '你好，谢谢，会议，邮件。' },
  { code: 'hi', label: 'Hindi', whisperPrompt: 'नमस्ते, धन्यवाद, बैठक, ईमेल.' },
  { code: 'ar', label: 'Arabic', whisperPrompt: 'مرحبا، شكرا، اجتماع، بريد.' },
  { code: 'pl', label: 'Polish', whisperPrompt: 'Cześć, dziękuję, spotkanie, email.' },
  { code: 'tr', label: 'Turkish', whisperPrompt: 'Merhaba, teşekkürler, toplantı, email.' },
  { code: 'ru', label: 'Russian', whisperPrompt: 'Привет, спасибо, встреча, email.' },
  { code: 'sv', label: 'Swedish', whisperPrompt: 'Hej, tack, möte, email.' },
]

export const DICTATION_OUTPUT_LANGUAGES: DictationLanguageOption[] = [
  { code: 'same', label: 'Same as spoken language' },
  ...DICTATION_LANGUAGES.filter((lang) => lang.code !== 'auto'),
]

export function dictationLanguageLabel(code: string): string {
  return DICTATION_LANGUAGES.find((lang) => lang.code === code)?.label ?? code
}

export function dictationWhisperPrompt(code: string): string | undefined {
  return DICTATION_LANGUAGES.find((lang) => lang.code === code)?.whisperPrompt
}

export function dictationLanguageName(code: string): string {
  if (code === 'same' || code === 'auto') return 'the spoken language'
  return dictationLanguageLabel(code)
}
