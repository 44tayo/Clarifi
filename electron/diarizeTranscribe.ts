import fetch from 'node-fetch'

import { splitWordsIntoSpeakerRuns } from '../shared/speakerRuns'
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

/** Prefer Deepgram utterance objects; fall back to gap-aware word runs. */
export function parseDeepgramUtterances(data: DeepgramResponse): DiarizedUtterance[] {
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
    const runs = splitWordsIntoSpeakerRuns(
      words.map((word) => ({
        token: word.punctuated_word ?? word.word ?? '',
        speaker: typeof word.speaker === 'number' ? word.speaker : 0,
        startMs: typeof word.start === 'number' ? Math.round(word.start * 1000) : undefined,
        endMs: typeof word.end === 'number' ? Math.round(word.end * 1000) : undefined,
      })),
    )
    for (const run of runs) {
      pushUtterance(
        results,
        run.speakerIndex,
        run.text,
        typeof run.startMs === 'number' ? run.startMs / 1000 : undefined,
        typeof run.endMs === 'number' ? run.endMs / 1000 : undefined,
      )
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

function buildBatchQuery(langParam: string, keyterms: string[] = []): string {
  // Batch v2 diarizer is stronger on multi-speaker meetings than streaming v1.
  const params = new URLSearchParams({
    model: 'nova-3',
    diarize_model: 'v2',
    punctuate: 'true',
    utterances: 'true',
    paragraphs: 'true',
    smart_format: 'true',
    mip_opt_out: 'true',
    filler_words: 'true',
  })
  for (const term of keyterms.slice(0, 40)) {
    const cleaned = term.trim()
    if (cleaned) params.append('keyterm', cleaned)
  }
  const base = params.toString()
  return `${base}${langParam}`
}

async function diarizeWithDeepgram(
  audioBase64: string,
  keyterms: string[] = [],
): Promise<DiarizedUtterance[] | null> {
  const language = getTranscriptionLanguage()
  const langParam =
    language && language !== 'auto' ? `&language=${language}` : '&detect_language=true'
  const baseQuery = buildBatchQuery(langParam, keyterms)
  const audioBuffer = Buffer.from(audioBase64, 'base64')

  const pcm = extractPcmFromWav(audioBuffer)
  const attempts: Array<{ body: Buffer; contentType: string; query: string }> = []

  if (pcm && pcm.length > 0) {
    attempts.push({
      body: pcm,
      contentType: 'application/octet-stream',
      query: `${baseQuery}&encoding=linear16&sample_rate=16000&channels=1`,
    })
  }

  attempts.push({
    body: audioBuffer,
    contentType: 'audio/wav',
    query: baseQuery,
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
  options?: { keyterms?: string[] },
): Promise<DiarizedUtterance[] | null> {
  try {
    const results = await diarizeWithDeepgram(audioBase64, options?.keyterms ?? [])
    if (!results || results.length === 0) {
      console.warn('Deepgram returned no usable diarized utterances for system audio chunk')
    }
    return results
  } catch (err) {
    console.error('Diarization error:', err)
    return null
  }
}
