import fs from 'node:fs'
import path from 'node:path'

import { app } from 'electron'

import {
  buildIndexFromMeetings,
  hybridRetrieve,
  packHybridHits,
  type HybridHit,
  type RetrievalChunk,
  type RetrievalMeeting,
} from '../shared/meetingRetrieval'
import type { StoredMeeting } from './meetingStore'

function indexPath(): string {
  return path.join(app.getPath('userData'), 'retrieval-index.json')
}

type PersistedIndex = {
  version: 1
  updatedAt: number
  chunks: RetrievalChunk[]
}

let memoryChunks: RetrievalChunk[] = []
let loaded = false

function toRetrievalMeeting(meeting: StoredMeeting): RetrievalMeeting {
  return {
    id: meeting.id,
    title: meeting.title,
    summary: meeting.summary,
    enhancedNotes: meeting.enhancedNotes,
    userNotes: meeting.userNotes,
    transcript: meeting.transcript?.map((entry: { text: string; at?: number }) => ({
      text: entry.text,
      at: entry.at,
    })),
    attendeeEmails: meeting.attendeeEmails,
    startedAt: meeting.startedAt,
    createdAt: meeting.createdAt,
  }
}

export function loadRetrievalIndex(): RetrievalChunk[] {
  if (loaded) return memoryChunks
  loaded = true
  try {
    const raw = fs.readFileSync(indexPath(), 'utf8')
    const parsed = JSON.parse(raw) as PersistedIndex
    if (parsed?.version === 1 && Array.isArray(parsed.chunks)) {
      memoryChunks = parsed.chunks
      return memoryChunks
    }
  } catch {
    memoryChunks = []
  }
  return memoryChunks
}

export function saveRetrievalIndex(chunks: RetrievalChunk[]): void {
  memoryChunks = chunks
  loaded = true
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    const payload: PersistedIndex = {
      version: 1,
      updatedAt: Date.now(),
      chunks,
    }
    fs.writeFileSync(indexPath(), JSON.stringify(payload), 'utf8')
  } catch (err) {
    console.error('Failed to persist retrieval index', err)
  }
}

export function rebuildRetrievalIndex(meetings: StoredMeeting[]): RetrievalChunk[] {
  const chunks = buildIndexFromMeetings(meetings.map(toRetrievalMeeting), true)
  saveRetrievalIndex(chunks)
  return chunks
}

export function retrievePackedContext(
  meetings: StoredMeeting[],
  query: string,
  options?: { topK?: number; budgetChars?: number },
): { packed: string; hits: HybridHit[]; meetingIds: string[] } {
  let chunks = loadRetrievalIndex()
  if (chunks.length === 0 && meetings.length > 0) {
    chunks = rebuildRetrievalIndex(meetings)
  }

  // Ensure scoped meetings are present even if index is stale.
  const scopedIds = new Set(meetings.map((meeting) => meeting.id))
  const scopedChunks = chunks.filter((chunk) => scopedIds.has(chunk.meetingId))
  const effective =
    scopedChunks.length > 0
      ? scopedChunks
      : buildIndexFromMeetings(meetings.map(toRetrievalMeeting), true)

  const hits = hybridRetrieve(effective, query, { topK: options?.topK })
  const packed = packHybridHits(hits, options?.budgetChars)
  const meetingIds = [...new Set(hits.map((hit) => hit.chunk.meetingId))]
  return { packed, hits, meetingIds }
}
