import fetch from 'node-fetch'

import { getTranscriptionLanguage } from './audioPreferences'
import { getDeepgramApiBaseUrl, getDeepgramApiKey } from './keys'
import { proxyDiarize } from './proxyClient'
import { isLikelyHallucination, normalizeTranscriptText } from './transcriptUtils'

export type DiarizedUtterance = {
  speaker: string
  text: string
  /** Seconds relative to the start of the submitted audio chunk. */
  startSec?: number
  /** Seconds relative to the start of the submitted audio chunk. */
  endSec?: number
  /** Raw Deepgram speaker index for session continuity mapping. */
  deepgramIndex?: number
}

function formatSpeakerLabel(speakerIndex: number): string {
  return `Speaker ${speakerIndex + 1}`
}

type DeepgramWord = {
  word?: string
  speaker?: number
  punctuated_word?: string
  start?: number
  end?: number
}

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
  startSec?: number,
  endSec?: number,
): void {
  const normalized = normalizeTranscriptText(text)
  if (!normalized) return
  results.push({
    speaker: formatSpeakerLabel(speakerIndex),
    text: normalized,
    startSec,
    endSec,
    deepgramIndex: speakerIndex,
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
    pushUtterance(
      results,
      typeof utterance.speaker === 'number' ? utterance.speaker : 0,
      utterance.transcript ?? '',
      typeof utterance.start === 'number' ? utterance.start : undefined,
      typeof utterance.end === 'number' ? utterance.end : undefined,
    )
  }
  if (results.length > 0) return results

  const words = data.results?.channels?.[0]?.alternatives?.[0]?.words ?? []
  if (words.length > 0) {
    let speakerIndex = typeof words[0].speaker === 'number' ? words[0].speaker : 0
    let parts: string[] = []
    let segmentStart = typeof words[0].start === 'number' ? words[0].start : undefined
    let segmentEnd = typeof words[0].end === 'number' ? words[0].end : undefined

    // Debounce single-word diarization flips — same rationale as the live
    // path in deepgramLive.ts: don't fragment a short real utterance into
    // its own island just because one word briefly flips speaker index.
    let pendingIndex: number | null = null
    let pendingTokens: string[] = []
    let pendingStart: number | undefined
    let pendingEnd: number | undefined

    const foldPendingIntoCurrent = () => {
      if (pendingTokens.length === 0) return
      parts.push(...pendingTokens)
      if (typeof pendingEnd === 'number') segmentEnd = pendingEnd
      pendingIndex = null
      pendingTokens = []
      pendingStart = undefined
      pendingEnd = undefined
    }

    const commitPending = () => {
      pushUtterance(results, speakerIndex, parts.join(' '), segmentStart, segmentEnd)
      parts = pendingTokens
      speakerIndex = pendingIndex!
      segmentStart = pendingStart
      segmentEnd = pendingEnd
      pendingIndex = null
      pendingTokens = []
      pendingStart = undefined
      pendingEnd = undefined
    }

    for (const word of words) {
      const nextSpeaker = typeof word.speaker === 'number' ? word.speaker : speakerIndex
      const token = word.punctuated_word ?? word.word ?? ''
      if (!token) continue
      const wordStart = typeof word.start === 'number' ? word.start : undefined
      const wordEnd = typeof word.end === 'number' ? word.end : undefined

      if (nextSpeaker === speakerIndex) {
        foldPendingIntoCurrent()
        parts.push(token)
        if (typeof wordEnd === 'number') segmentEnd = wordEnd
        continue
      }

      if (pendingIndex === nextSpeaker) {
        pendingTokens.push(token)
        pendingEnd = wordEnd
        commitPending()
        continue
      }

      foldPendingIntoCurrent()
      pendingIndex = nextSpeaker
      pendingTokens = [token]
      pendingStart = wordStart
      pendingEnd = wordEnd
    }

    foldPendingIntoCurrent()
    if (parts.length > 0) {
      pushUtterance(results, speakerIndex, parts.join(' '), segmentStart, segmentEnd)
    }
    if (results.length > 0) return results
  }

  const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''
  if (transcript) {
    pushUtterance(results, 0, transcript, 0)
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
    'model=nova-3&diarize_model=latest&punctuate=true&utterances=true&smart_format=true&mip_opt_out=true&filler_words=true'
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

  let hadApiKey = false
  for (const attempt of attempts) {
    const apiKey = await getDeepgramApiKey()
    if (!apiKey) break
    hadApiKey = true
    const data = await callDeepgram(apiKey, attempt.body, attempt.contentType, attempt.query)
    if (!data) continue
    const results = parseDeepgramUtterances(data)
    if (results.length > 0) return results
    const fallbackTranscript =
      data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? ''
    if (fallbackTranscript && !isLikelyHallucination(fallbackTranscript, 'system')) {
      return [
        {
          speaker: 'Speaker 1',
          text: normalizeTranscriptText(fallbackTranscript),
          startSec: 0,
          deepgramIndex: 0,
        },
      ]
    }
  }

  if (!hadApiKey) {
    console.warn('Deepgram API key missing — trying cloud proxy diarize')
  }

  const proxied = await proxyDiarize(audioBase64)
  if (proxied && proxied.length > 0) {
    return proxied.map((item, index) => ({
      ...item,
      deepgramIndex:
        typeof item.deepgramIndex === 'number'
          ? item.deepgramIndex
          : Math.max(0, Number(String(item.speaker).match(/(\d+)/)?.[1] ?? index + 1) - 1),
    }))
  }

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
