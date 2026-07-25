import { authorizeLlmRequest } from '@/lib/llm-route-auth'

const MAX_AUDIO_BYTES = 15 * 1024 * 1024

type DeepgramUtterance = {
  speaker?: number
  transcript?: string
  start?: number
  end?: number
}

type DeepgramResponse = {
  results?: {
    utterances?: DeepgramUtterance[]
    channels?: Array<{
      alternatives?: Array<{ transcript?: string }>
    }>
  }
}

function formatSpeaker(index: number): string {
  return `Speaker ${index + 1}`
}

export async function POST(req: Request) {
  const auth = await authorizeLlmRequest(req)
  if (auth instanceof Response) return auth

  const apiKey = process.env.DEEPGRAM_API_KEY?.trim()
  if (!apiKey) {
    return Response.json({ error: 'deepgram_not_configured' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const payload = body as { audioBase64?: string; language?: string }
  if (!payload.audioBase64 || typeof payload.audioBase64 !== 'string') {
    return Response.json({ error: 'audio_required' }, { status: 400 })
  }

  const approxDecodedBytes = Math.floor((payload.audioBase64.length * 3) / 4)
  if (approxDecodedBytes > MAX_AUDIO_BYTES) {
    return Response.json({ error: 'audio_too_large' }, { status: 413 })
  }

  const language =
    typeof payload.language === 'string' && payload.language !== 'auto'
      ? payload.language
      : null
  const langParam = language ? `&language=${encodeURIComponent(language)}` : '&detect_language=true'
  const query = `model=nova-3&diarize_model=latest&punctuate=true&utterances=true&smart_format=true&mip_opt_out=true${langParam}`

  const audioBuffer = Buffer.from(payload.audioBase64, 'base64')
  const response = await fetch(`https://api.deepgram.com/v1/listen?${query}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'audio/wav',
    },
    body: audioBuffer,
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('Deepgram proxy error:', err)
    return Response.json({ error: 'diarize_failed' }, { status: 500 })
  }

  const data = (await response.json()) as DeepgramResponse
  const utterances = (data.results?.utterances ?? [])
    .map((item) => ({
      speaker: formatSpeaker(typeof item.speaker === 'number' ? item.speaker : 0),
      text: item.transcript?.trim() ?? '',
      startSec: typeof item.start === 'number' ? item.start : undefined,
      endSec: typeof item.end === 'number' ? item.end : undefined,
      deepgramIndex: typeof item.speaker === 'number' ? item.speaker : 0,
    }))
    .filter((item) => item.text.length > 0)

  if (utterances.length > 0) {
    return Response.json({ utterances })
  }

  const fallback = data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? ''
  if (fallback) {
    return Response.json({
      utterances: [{ speaker: 'Speaker 1', text: fallback, startSec: 0, deepgramIndex: 0 }],
    })
  }

  return Response.json({ utterances: [] })
}
