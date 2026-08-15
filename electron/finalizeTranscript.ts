import * as fs from 'fs'
import { randomUUID } from 'crypto'

import { transcribeSystemWithDiarization } from './diarizeTranscribe'
import { absoluteRecordingPath } from './meetingRecording'
import type { StoredMeeting } from './meetingStore'
import {
  isDuplicateAcrossStreams,
  normalizeTranscriptEntry,
  type TranscriptEntry,
} from './transcriptUtils'

/** ~7.5 min of 16 kHz mono 16-bit PCM (+ WAV header) stays under common API caps. */
const MAX_FINALIZE_BYTES = 14 * 1024 * 1024

export function buildMeetingKeyterms(meeting: StoredMeeting): string[] {
  const terms = new Set<string>()
  for (const person of meeting.attendees ?? []) {
    const name = person.name?.trim()
    if (name) terms.add(name)
  }
  for (const label of Object.values(meeting.speakerLabels ?? {})) {
    const name = label?.trim()
    if (name && !/^speaker\s+\d+$/i.test(name) && name.toLowerCase() !== 'me') {
      terms.add(name)
    }
  }
  for (const identity of Object.values(meeting.speakerIdentities ?? {})) {
    const name = identity.displayName?.trim()
    if (name) terms.add(name)
  }
  const title = meeting.title?.trim()
  if (title) {
    for (const part of title.split(/[\s|/,_-]+/)) {
      if (part.length >= 3) terms.add(part)
    }
  }
  // Common meeting / GTM nouns that STT often mangles.
  for (const term of [
    'KubeCon',
    're:Invent',
    'GitOps',
    'CI/CD',
    'GTM',
    'PMM',
    'GitLab',
  ]) {
    terms.add(term)
  }
  return [...terms].slice(0, 40)
}

function entryTime(entry: TranscriptEntry): number {
  if (typeof entry.audioStartMs === 'number') return entry.audioStartMs
  return entry.at
}

/**
 * Re-diarize the saved system-audio recording with batch Deepgram v2 and
 * replace live system Speaker N lines. Keeps mic "Me" lines that aren't
 * duplicates of the finalized system transcript.
 */
export async function finalizeSystemTranscript(
  meeting: StoredMeeting,
  liveTranscript: TranscriptEntry[],
): Promise<TranscriptEntry[] | null> {
  const filePath = absoluteRecordingPath(meeting.id)
  if (!fs.existsSync(filePath)) return null

  let wav: Buffer
  try {
    wav = fs.readFileSync(filePath)
  } catch {
    return null
  }
  if (wav.length < 48 || wav.length > MAX_FINALIZE_BYTES) {
    if (wav.length > MAX_FINALIZE_BYTES) {
      console.warn(
        `Finalize diarize skipped — recording ${wav.length} bytes exceeds ${MAX_FINALIZE_BYTES}`,
      )
    }
    return null
  }

  const utterances = await transcribeSystemWithDiarization(wav.toString('base64'), {
    keyterms: buildMeetingKeyterms(meeting),
  })
  if (!utterances?.length) return null

  const startedAt = meeting.startedAt ?? meeting.createdAt
  const systemEntries: TranscriptEntry[] = utterances.map((utterance, index) => {
    const audioStartMs =
      typeof utterance.startSec === 'number' ? Math.max(0, Math.round(utterance.startSec * 1000)) : 0
    const audioEndMs =
      typeof utterance.endSec === 'number'
        ? Math.max(audioStartMs, Math.round(utterance.endSec * 1000))
        : undefined
    return normalizeTranscriptEntry({
      id: `final-sys-${index}-${randomUUID().slice(0, 8)}`,
      text: utterance.text,
      source: 'system',
      speaker: utterance.speaker,
      at: startedAt + audioStartMs,
      audioStartMs,
      ...(typeof audioEndMs === 'number' ? { audioEndMs } : {}),
    })
  })

  const micEntries = liveTranscript.filter((entry) => {
    if (entry.source !== 'mic' && entry.speaker !== 'Me') return false
    return !isDuplicateAcrossStreams(entry.text, systemEntries, entry.at, 'mic', 20_000)
  })

  const merged = [...systemEntries, ...micEntries].sort((a, b) => entryTime(a) - entryTime(b))
  console.log(
    `Finalize diarize: ${systemEntries.length} system turn(s), kept ${micEntries.length} mic line(s)`,
  )
  return merged
}
