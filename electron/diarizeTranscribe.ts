import fetch from 'node-fetch'

import { getTranscriptionLanguage } from './audioPreferences'
import { getDeepgramApiBaseUrl, getDeepgramApiKey } from './keys'
import { proxyDiarize } from './proxyClient'
import { isLikelyHallucination, normalizeTranscriptText } from './transcriptUtils'

export type DiarizedUtterance = {
  speaker: string
  text: string
}

function formatSpeakerLabel(speakerIndex: number): string {
  return `Speaker ${speakerIndex + 1}`
}

type DeepgramWord = {
  word?: string
  speaker?: number
  punctuated_word?: string
}

type DeepgramResponse = {
  results?: {
    utterances?: Array<{ speaker?: number; transcript?: string }>
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string
        words?: DeepgramWord[]
      }>
    }>
  }
}

function pushUtterance(
  results: DiarizedUtterance[],
  speakerIndex: number,
  text: string,
): void {
  const normalized = normalizeTranscriptText(text)
  if (!normalized) return
  results.push({
    speaker: formatSpeakerLabel(speakerIndex),
    text: normalized,
  })
}

function extractPcmFromWav(buffer: Buffer): Buffer | null {
  if (buffer.length < 48 || buffer.toString('ascii', 0, 4) !== 'RIFF') {
    return null
  }
  return buffer.subarray(44)
}

function parseDeepgramUtterances(data: DeepgramResponse): DiarizedUtterance[] {
  const results: DiarizedUtterance[] = []

  for (const utterance of data.results?.utterances ?? []) {
    pushUtterance(results, typeof utterance.speaker === 'number' ? utterance.speaker : 0, utterance.transcript ?? '')
  }
  if (results.length > 0) return results

  const words = data.results?.channels?.[0]?.alternatives?.[0]?.words ?? []
  if (words.length > 0) {
    let speakerIndex = typeof words[0].speaker === 'number' ? words[0].speaker : 0
    let parts: string[] = []

    for (const word of words) {
      const nextSpeaker = typeof word.speaker === 'number' ? word.speaker : speakerIndex
      const token = word.punctuated_word ?? word.word ?? ''
      if (!token) continue

      if (nextSpeaker !== speakerIndex && parts.length > 0) {
        pushUtterance(results, speakerIndex, parts.join(' '))
        parts = []
        speakerIndex = nextSpeaker
      }

      parts.push(token)
      speakerIndex = nextSpeaker
    }

    if (parts.length > 0) {
      pushUtterance(results, speakerIndex, parts.join(' '))
    }
    if (results.length > 0) return results
  }

  const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''
  if (transcript) {
    pushUtterance(results, 0, transcript)
  }

  return results
}

async function callDeepgram(
  apiKey: string,
  body: Buffer,
  contentType: string,
  query: string,
): Promise<DeepgramResponse | null> {
  const response = await fetch(`${getDeepgramApiBaseUrl()}/v1/listen?${query}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': contentType,
    },
    body,
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('Deepgram error:', err)
    return null
  }

  return (await response.json()) as DeepgramResponse
}

async function diarizeWithDeepgram(audioBase64: string): Promise<DiarizedUtterance[] | null> {
  const language = getTranscriptionLanguage()
  const langParam =
    language && language !== 'auto' ? `&language=${language}` : '&detect_language=true'
  const baseQuery =
    'model=nova-2&diarize=true&punctuate=true&utterances=true&smart_format=true&mip_opt_out=true'
  const audioBuffer = Buffer.from(audioBase64, 'base64')

  const pcm = extractPcmFromWav(audioBuffer)
  const attempts: Array<{ body: Buffer; contentType: string; query: string }> = []

  if (pcm && pcm.length > 0) {
    attempts.push({
      body: pcm,
      contentType: 'application/octet-stream',
      query: `${baseQuery}&encoding=linear16&sample_rate=16000&channels=1${langParam}`,
    })
  }

  attempts.push({
    body: audioBuffer,
    contentType: 'audio/wav',
    query: `${baseQuery}${langParam}`,
  })

  for (const attempt of attempts) {
    const apiKey = await getDeepgramApiKey()
    if (!apiKey) break
    const data = await callDeepgram(apiKey, attempt.body, attempt.contentType, attempt.query)
    if (!data) continue
    const results = parseDeepgramUtterances(data)
    if (results.length > 0) return results
    const fallbackTranscript =
      data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? ''
    if (fallbackTranscript && !isLikelyHallucination(fallbackTranscript, 'system')) {
      return [{ speaker: 'Speaker 1', text: normalizeTranscriptText(fallbackTranscript) }]
    }
  }

  const proxied = await proxyDiarize(audioBase64)
  if (proxied && proxied.length > 0) return proxied

  return null
}

export async function transcribeSystemWithDiarization(
  audioBase64: string,
): Promise<DiarizedUtterance[] | null> {
  try {
    const results = await diarizeWithDeepgram(audioBase64)
    if (!results || results.length === 0) {
      console.warn('Deepgram returned no usable diarized utterances for system audio chunk')
    }
    return results
  } catch (err) {
    console.error('Diarization error:', err)
    return null
  }
}
