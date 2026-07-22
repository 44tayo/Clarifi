import { app, safeStorage } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'

import type { TranscriptEntry } from './transcriptUtils'

export type MeetingStatus = 'draft' | 'live' | 'processing' | 'ready' | 'error'

export type StoredFolder = {
  id: string
  name: string
  createdAt: number
  sortOrder: number
}

export type StoredMeeting = {
  id: string
  title: string
  createdAt: number
  startedAt?: number
  endedAt?: number
  status: MeetingStatus
  userNotes: string
  transcript: TranscriptEntry[]
  speakerLabels?: Record<string, string>
  calendarEventId?: string
  calendarProvider?: 'google' | 'microsoft'
  scheduledStart?: number
  attendeeEmails?: string[]
  folderIds?: string[]
  enhancedNotes?: string
  summary?: string
  actionItems?: string[]
  enhanceError?: string
}

type StoreBlob = {
  meetings: StoredMeeting[]
  folders: StoredFolder[]
}

const MAX_MEETINGS = 100

function storePath(): string {
  return path.join(app.getPath('userData'), 'meetings.json.enc')
}

function legacyPlaintextPath(): string {
  return path.join(app.getPath('userData'), 'meetings.json')
}

function normalizeBlob(raw: unknown): StoreBlob {
  if (Array.isArray(raw)) {
    return { meetings: raw as StoredMeeting[], folders: [] }
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as { meetings?: unknown; folders?: unknown }
    return {
      meetings: Array.isArray(obj.meetings) ? (obj.meetings as StoredMeeting[]) : [],
      folders: Array.isArray(obj.folders) ? (obj.folders as StoredFolder[]) : [],
    }
  }
  return { meetings: [], folders: [] }
}

function readEncrypted(): StoreBlob | null {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null
    const raw = fs.readFileSync(storePath())
    const decrypted = safeStorage.decryptString(raw)
    return normalizeBlob(JSON.parse(decrypted))
  } catch {
    return null
  }
}

function readLegacyPlaintext(): StoreBlob {
  try {
    const raw = fs.readFileSync(legacyPlaintextPath(), 'utf-8')
    return normalizeBlob(JSON.parse(raw))
  } catch {
    return { meetings: [], folders: [] }
  }
}

function readBlob(): StoreBlob {
  const encrypted = readEncrypted()
  if (encrypted) return encrypted

  const legacy = readLegacyPlaintext()
  if (legacy.meetings.length > 0 || legacy.folders.length > 0) {
    writeBlob(legacy)
    try {
      fs.unlinkSync(legacyPlaintextPath())
    } catch {
      // Non-critical if legacy file removal fails.
    }
  }
  return legacy
}

function writeBlob(blob: StoreBlob): void {
  const dir = path.dirname(storePath())
  fs.mkdirSync(dir, { recursive: true })
  const payload: StoreBlob = {
    meetings: blob.meetings.slice(0, MAX_MEETINGS),
    folders: blob.folders,
  }
  const json = JSON.stringify(payload, null, 2)

  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(storePath(), safeStorage.encryptString(json))
    return
  }

  console.warn('safeStorage encryption unavailable; meeting notes will be stored unencrypted')
  fs.writeFileSync(legacyPlaintextPath(), json)
}

function readAll(): StoredMeeting[] {
  return readBlob().meetings
}

function writeAll(meetings: StoredMeeting[]): void {
  const blob = readBlob()
  writeBlob({ ...blob, meetings })
}

export function listMeetings(): StoredMeeting[] {
  return readAll().sort((a, b) => (b.startedAt ?? b.createdAt) - (a.startedAt ?? a.createdAt))
}

export function getMeeting(id: string): StoredMeeting | null {
  return readAll().find((m) => m.id === id) ?? null
}

export type CreateMeetingInput = {
  title?: string
  calendarEventId?: string
  calendarProvider?: 'google' | 'microsoft'
  scheduledStart?: number
  attendeeEmails?: string[]
  speakerLabels?: Record<string, string>
  folderIds?: string[]
}

export function createMeeting(input?: CreateMeetingInput | string): StoredMeeting {
  const options: CreateMeetingInput =
    typeof input === 'string' ? { title: input } : (input ?? {})
  const now = Date.now()
  const meeting: StoredMeeting = {
    id: randomUUID(),
    title: options.title?.trim() || defaultTitle(options.scheduledStart ?? now),
    createdAt: now,
    status: 'draft',
    userNotes: '',
    transcript: [],
    speakerLabels: options.speakerLabels ?? {},
    calendarEventId: options.calendarEventId,
    calendarProvider: options.calendarProvider,
    scheduledStart: options.scheduledStart,
    attendeeEmails: options.attendeeEmails,
    folderIds: options.folderIds ?? [],
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

export function listFolders(): StoredFolder[] {
  return readBlob().folders.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
}

export function createFolder(name: string): StoredFolder {
  const blob = readBlob()
  const trimmed = name.trim() || 'Untitled folder'
  const folder: StoredFolder = {
    id: randomUUID(),
    name: trimmed,
    createdAt: Date.now(),
    sortOrder: blob.folders.length,
  }
  writeBlob({ ...blob, folders: [...blob.folders, folder] })
  return folder
}

export function renameFolder(id: string, name: string): StoredFolder | null {
  const blob = readBlob()
  const index = blob.folders.findIndex((f) => f.id === id)
  if (index < 0) return null
  const trimmed = name.trim()
  if (!trimmed) return blob.folders[index]!
  blob.folders[index] = { ...blob.folders[index]!, name: trimmed }
  writeBlob(blob)
  return blob.folders[index]!
}

export function deleteFolder(id: string): boolean {
  const blob = readBlob()
  const nextFolders = blob.folders.filter((f) => f.id !== id)
  if (nextFolders.length === blob.folders.length) return false
  const meetings = blob.meetings.map((meeting) => ({
    ...meeting,
    folderIds: (meeting.folderIds ?? []).filter((folderId) => folderId !== id),
  }))
  writeBlob({ meetings, folders: nextFolders })
  return true
}

export function setMeetingFolders(meetingId: string, folderIds: string[]): StoredMeeting | null {
  const valid = new Set(listFolders().map((f) => f.id))
  const unique = Array.from(new Set(folderIds.filter((id) => valid.has(id))))
  return updateMeeting(meetingId, { folderIds: unique })
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
