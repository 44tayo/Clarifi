import { app, safeStorage } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'

import type { TranscriptEntry } from './transcriptUtils'

export type MeetingStatus = 'draft' | 'live' | 'processing' | 'ready' | 'error'

export type StoredMeeting = {
  id: string
  title: string
  createdAt: number
  startedAt?: number
  endedAt?: number
  status: MeetingStatus
  userNotes: string
  transcript: TranscriptEntry[]
  enhancedNotes?: string
  summary?: string
  actionItems?: string[]
  enhanceError?: string
}

const MAX_MEETINGS = 100

function storePath(): string {
  return path.join(app.getPath('userData'), 'meetings.json.enc')
}

// Path used before meeting notes/transcripts were encrypted at rest. Only
// read from here to migrate existing data into the encrypted store; the
// plaintext file is removed once that migration succeeds.
function legacyPlaintextPath(): string {
  return path.join(app.getPath('userData'), 'meetings.json')
}

function readEncrypted(): StoredMeeting[] | null {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null
    const raw = fs.readFileSync(storePath())
    const decrypted = safeStorage.decryptString(raw)
    const parsed = JSON.parse(decrypted) as StoredMeeting[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return null
  }
}

function readLegacyPlaintext(): StoredMeeting[] {
  try {
    const raw = fs.readFileSync(legacyPlaintextPath(), 'utf-8')
    const parsed = JSON.parse(raw) as StoredMeeting[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readAll(): StoredMeeting[] {
  const encrypted = readEncrypted()
  if (encrypted) return encrypted

  const legacy = readLegacyPlaintext()
  if (legacy.length > 0) {
    writeAll(legacy)
    try {
      fs.unlinkSync(legacyPlaintextPath())
    } catch {
      // Not critical if the old plaintext file can't be removed — the
      // encrypted copy is already the source of truth going forward.
    }
  }
  return legacy
}

function writeAll(meetings: StoredMeeting[]): void {
  const dir = path.dirname(storePath())
  fs.mkdirSync(dir, { recursive: true })
  const json = JSON.stringify(meetings.slice(0, MAX_MEETINGS), null, 2)

  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(storePath(), safeStorage.encryptString(json))
    return
  }

  // No OS-backed encryption available (rare — e.g. some Linux setups
  // without a keyring). Fall back to plaintext rather than losing data.
  console.warn('safeStorage encryption unavailable; meeting notes will be stored unencrypted')
  fs.writeFileSync(legacyPlaintextPath(), json)
}

export function listMeetings(): StoredMeeting[] {
  return readAll().sort((a, b) => (b.startedAt ?? b.createdAt) - (a.startedAt ?? a.createdAt))
}

export function getMeeting(id: string): StoredMeeting | null {
  return readAll().find((m) => m.id === id) ?? null
}

export function createMeeting(title?: string): StoredMeeting {
  const now = Date.now()
  const meeting: StoredMeeting = {
    id: randomUUID(),
    title: title?.trim() || defaultTitle(now),
    createdAt: now,
    status: 'draft',
    userNotes: '',
    transcript: [],
  }
  const meetings = readAll()
  meetings.unshift(meeting)
  writeAll(meetings)
  return meeting
}

export function updateMeeting(
  id: string,
  patch: Partial<Omit<StoredMeeting, 'id' | 'createdAt'>>,
): StoredMeeting | null {
  const meetings = readAll()
  const index = meetings.findIndex((m) => m.id === id)
  if (index < 0) return null
  meetings[index] = { ...meetings[index]!, ...patch, id, createdAt: meetings[index]!.createdAt }
  writeAll(meetings)
  return meetings[index]!
}

export function deleteMeeting(id: string): boolean {
  const meetings = readAll()
  const next = meetings.filter((m) => m.id !== id)
  if (next.length === meetings.length) return false
  writeAll(next)
  return true
}

function defaultTitle(at: number): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(at))
}
