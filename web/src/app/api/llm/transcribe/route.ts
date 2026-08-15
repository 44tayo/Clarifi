import { authorizeLlmRequest } from '@/lib/llm-route-auth'
import { transcribeAudio } from '@/lib/groq-server'

// Comfortably under Groq Whisper's 25 MB file limit, applied to the
// *decoded* audio size (base64 text is ~4/3 the size of the raw bytes).
const MAX_AUDIO_BYTES = 15 * 1024 * 1024

export async function POST(req: Request) {
  const auth = await authorizeLlmRequest(req)
  if (auth instanceof Response) return auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const payload = body as {
    audioBase64?: string
    format?: 'wav' | 'webm'
    language?: string
    prompt?: string
  }

  if (!payload.audioBase64 || typeof payload.audioBase64 !== 'string') {
    return Response.json({ error: 'audio_required' }, { status: 400 })
  }

  // Cheap length check before touching the string further — avoids decoding
  // (or forwarding to Groq) an oversized or malformed payload.
  const approxDecodedBytes = Math.floor((payload.audioBase64.length * 3) / 4)
  if (approxDecodedBytes > MAX_AUDIO_BYTES) {
    return Response.json(
      { error: 'audio_too_large', maxBytes: MAX_AUDIO_BYTES },
      { status: 413 },
    )
  }

  const format = payload.format === 'wav' ? 'wav' : 'webm'
  const language =
    typeof payload.language === 'string' && payload.language.trim()
      ? payload.language.trim()
      : 'en'
  const prompt =
    typeof payload.prompt === 'string' && payload.prompt.trim()
      ? payload.prompt.trim()
      : undefined
  const text = await transcribeAudio(payload.audioBase64, format, language, prompt)

  if (!text) {
    return Response.json({ error: 'transcribe_failed' }, { status: 500 })
  }

  return Response.json({ text })
}
