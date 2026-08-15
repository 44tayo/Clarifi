import { app, safeStorage } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'

import type { MeetingTemplateId } from '../shared/meetingTemplates'
import type { MeetingAttendee, SpeakerIdentities } from '../shared/speakers'
import {
  DEFAULT_FOLDER_COLOR,
  DEFAULT_FOLDER_ICON,
  canReparentFolder,
  isFolderColorId,
  isFolderEmoji,
  isFolderIconId,
  type FolderColorId,
} from '../shared/folderAppearance'
import { aggregateTags, normalizeTags } from '../shared/tags'
import type { TranscriptEntry } from './transcriptUtils'

export type MeetingStatus = 'draft' | 'live' | 'processing' | 'ready' | 'error'

export type StoredFolder = {
  id: string
  name: string
  createdAt: number
  sortOrder: number
  color: FolderColorId
  /** Built-in icon id or a short emoji string. */
  icon: string
  parentId: string | null
}

export type CreateFolderInput = {
  name?: string
  color?: string
  icon?: string
  parentId?: string | null
}

export type UpdateFolderPatch = {
  name?: string
  color?: string
  icon?: string
  parentId?: string | null
  sortOrder?: number
}

export type StoredMeeting = {
  id: string
  title: string
  createdAt: number
  updatedAt?: number
  startedAt?: number
  endedAt?: number
  status: MeetingStatus
  userNotes: string
  transcript: TranscriptEntry[]
  speakerLabels?: Record<string, string>
  speakerIdentities?: SpeakerIdentities
  calendarEventId?: string
  calendarProvider?: 'google' | 'microsoft'
  scheduledStart?: number
  attendeeEmails?: string[]
  attendees?: MeetingAttendee[]
  folderIds?: string[]
  tags?: string[]
  templateId?: MeetingTemplateId
  enhancedNotes?: string
  summary?: string
  actionItems?: string[]
  completedActionItems?: string[]
  /** Claim text → cached TRANSCRIPT SUMMARY from on-click eyeglass. */
  evidenceCache?: Record<string, string>
  enhanceError?: string
  /** Relative path under userData for local system-audio recording (snippet replay). */
  recordingPath?: string
}

type StoreBlob = {
  meetings: StoredMeeting[]
  folders: StoredFolder[]
  /** Meeting ids the user deleted — blocks demo reseed and cloud sync revive. */
  deletedMeetingIds?: string[]
}

const MAX_MEETINGS = 100
const MAX_DELETED_IDS = 2000

function storePath(): string {
  return path.join(app.getPath('userData'), 'meetings.json.enc')
}

function legacyPlaintextPath(): string {
  return path.join(app.getPath('userData'), 'meetings.json')
}

function normalizeFolder(raw: unknown, index: number): StoredFolder | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (typeof obj.id !== 'string' || typeof obj.name !== 'string') return null
  const color = isFolderColorId(obj.color) ? obj.color : DEFAULT_FOLDER_COLOR
  const icon =
    isFolderIconId(obj.icon) || isFolderEmoji(obj.icon) ? obj.icon : DEFAULT_FOLDER_ICON
  const parentId =
    typeof obj.parentId === 'string' && obj.parentId.trim() ? obj.parentId : null
  return {
    id: obj.id,
    name: obj.name,
    createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : Date.now(),
    sortOrder: typeof obj.sortOrder === 'number' ? obj.sortOrder : index,
    color,
    icon,
    parentId,
  }
}

function normalizeFolders(raw: unknown): StoredFolder[] {
  if (!Array.isArray(raw)) return []
  const folders = raw
    .map((item, index) => normalizeFolder(item, index))
    .filter((folder): folder is StoredFolder => Boolean(folder))
  const ids = new Set(folders.map((f) => f.id))
  // Drop invalid parent links / enforce depth after load
  return folders.map((folder) => {
    if (folder.parentId && !ids.has(folder.parentId)) {
      return { ...folder, parentId: null }
    }
    if (folder.parentId && !canReparentFolder(folders, folder.id, folder.parentId)) {
      return { ...folder, parentId: null }
    }
    return folder
  })
}

function normalizeBlob(raw: unknown): StoreBlob {
  if (Array.isArray(raw)) {
    return { meetings: raw as StoredMeeting[], folders: [], deletedMeetingIds: [] }
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as { meetings?: unknown; folders?: unknown; deletedMeetingIds?: unknown }
    return {
      meetings: Array.isArray(obj.meetings) ? (obj.meetings as StoredMeeting[]) : [],
      folders: normalizeFolders(obj.folders),
      deletedMeetingIds: Array.isArray(obj.deletedMeetingIds)
        ? obj.deletedMeetingIds.filter((id): id is string => typeof id === 'string')
        : [],
    }
  }
  return { meetings: [], folders: [], deletedMeetingIds: [] }
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
    deletedMeetingIds: (blob.deletedMeetingIds ?? []).slice(-MAX_DELETED_IDS),
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
  attendees?: MeetingAttendee[]
  speakerLabels?: Record<string, string>
  speakerIdentities?: SpeakerIdentities
  folderIds?: string[]
  templateId?: MeetingTemplateId
}

export function createMeeting(input?: CreateMeetingInput | string): StoredMeeting {
  const options: CreateMeetingInput =
    typeof input === 'string' ? { title: input } : (input ?? {})
  const now = Date.now()
  const meeting: StoredMeeting = {
    id: randomUUID(),
    title: options.title?.trim() || defaultTitle(options.scheduledStart ?? now),
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    userNotes: '',
    transcript: [],
    speakerLabels: options.speakerLabels ?? {},
    speakerIdentities: options.speakerIdentities ?? {},
    calendarEventId: options.calendarEventId,
    calendarProvider: options.calendarProvider,
    scheduledStart: options.scheduledStart,
    attendeeEmails: options.attendeeEmails,
    attendees: options.attendees,
    folderIds: options.folderIds ?? [],
    templateId: options.templateId ?? 'general',
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
  meetings[index] = {
    ...meetings[index]!,
    ...patch,
    id,
    createdAt: meetings[index]!.createdAt,
    updatedAt: Date.now(),
  }
  writeAll(meetings)
  return meetings[index]!
}

export function upsertMeetingSnapshot(meeting: StoredMeeting): StoredMeeting | null {
  // Never revive a meeting the user deleted — cloud sync and demo seed must respect tombstones.
  if ((readBlob().deletedMeetingIds ?? []).includes(meeting.id)) {
    return null
  }
  const meetings = readAll()
  const index = meetings.findIndex((m) => m.id === meeting.id)
  const next: StoredMeeting = {
    ...meeting,
    updatedAt: meeting.updatedAt ?? Date.now(),
  }
  if (index >= 0) {
    meetings[index] = { ...next, createdAt: meetings[index]!.createdAt }
  } else {
    meetings.unshift(next)
  }
  writeAll(meetings)
  return index >= 0 ? meetings[index]! : meetings[0]!
}

export function listDeletedMeetingIds(): string[] {
  return [...(readBlob().deletedMeetingIds ?? [])]
}

export function rememberDeletedMeetingId(id: string): void {
  const blob = readBlob()
  const deleted = new Set(blob.deletedMeetingIds ?? [])
  deleted.add(id)
  writeBlob({ ...blob, deletedMeetingIds: [...deleted] })
}

export function forgetDeletedMeetingIds(ids: string[]): void {
  if (ids.length === 0) return
  const blob = readBlob()
  const remove = new Set(ids)
  writeBlob({
    ...blob,
    deletedMeetingIds: (blob.deletedMeetingIds ?? []).filter((id) => !remove.has(id)),
  })
}

/** Drop any local copies that are still marked deleted (defense in depth). */
export function purgeTombstonedLocalMeetings(): string[] {
  const blob = readBlob()
  const deleted = new Set(blob.deletedMeetingIds ?? [])
  if (deleted.size === 0) return []
  const kept: StoredMeeting[] = []
  const removed: string[] = []
  for (const meeting of blob.meetings) {
    if (deleted.has(meeting.id)) removed.push(meeting.id)
    else kept.push(meeting)
  }
  if (removed.length === 0) return []
  writeBlob({ ...blob, meetings: kept })
  return removed
}

export function deleteMeeting(id: string): boolean {
  const blob = readBlob()
  const next = blob.meetings.filter((m) => m.id !== id)
  const deleted = new Set(blob.deletedMeetingIds ?? [])
  deleted.add(id)
  writeBlob({
    ...blob,
    meetings: next,
    deletedMeetingIds: [...deleted],
  })
  return next.length < blob.meetings.length
}

export function listFolders(): StoredFolder[] {
  return readBlob()
    .folders.slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
}

export function createFolder(input: CreateFolderInput | string = {}): StoredFolder {
  const blob = readBlob()
  const payload = typeof input === 'string' ? { name: input } : input
  const trimmed = (payload.name ?? '').trim() || 'Untitled folder'
  const color = isFolderColorId(payload.color) ? payload.color : DEFAULT_FOLDER_COLOR
  const icon =
    isFolderIconId(payload.icon) || isFolderEmoji(payload.icon)
      ? String(payload.icon)
      : DEFAULT_FOLDER_ICON
  let parentId =
    typeof payload.parentId === 'string' && payload.parentId.trim()
      ? payload.parentId.trim()
      : null
  if (parentId && !blob.folders.some((f) => f.id === parentId)) {
    parentId = null
  }
  if (parentId) {
    const parent = blob.folders.find((f) => f.id === parentId)
    // Only nest under root folders (max depth 1 for children)
    if (!parent || parent.parentId) {
      parentId = null
    }
  }

  const siblings = blob.folders.filter((f) => (f.parentId ?? null) === parentId)
  const folder: StoredFolder = {
    id: randomUUID(),
    name: trimmed,
    createdAt: Date.now(),
    sortOrder: siblings.length,
    color,
    icon,
    parentId,
  }
  writeBlob({ ...blob, folders: [...blob.folders, folder] })
  return folder
}

export function renameFolder(id: string, name: string): StoredFolder | null {
  return updateFolder(id, { name })
}

export function updateFolder(id: string, patch: UpdateFolderPatch): StoredFolder | null {
  const blob = readBlob()
  const index = blob.folders.findIndex((f) => f.id === id)
  if (index < 0) return null
  const current = blob.folders[index]!
  let next: StoredFolder = { ...current }

  if (typeof patch.name === 'string') {
    const trimmed = patch.name.trim()
    if (trimmed) next = { ...next, name: trimmed }
  }
  if (isFolderColorId(patch.color)) next = { ...next, color: patch.color }
  if (isFolderIconId(patch.icon) || isFolderEmoji(patch.icon)) {
    next = { ...next, icon: String(patch.icon) }
  }
  if (typeof patch.sortOrder === 'number' && Number.isFinite(patch.sortOrder)) {
    next = { ...next, sortOrder: patch.sortOrder }
  }
  if (patch.parentId !== undefined) {
    const parentId =
      typeof patch.parentId === 'string' && patch.parentId.trim() ? patch.parentId.trim() : null
    if (parentId === null || canReparentFolder(blob.folders, id, parentId)) {
      next = { ...next, parentId }
    }
  }

  blob.folders[index] = next
  writeBlob(blob)
  return next
}

export function deleteFolder(id: string): boolean {
  const blob = readBlob()
  const target = blob.folders.find((f) => f.id === id)
  if (!target) return false
  const parentId = target.parentId ?? null
  const nextFolders = blob.folders
    .filter((f) => f.id !== id)
    .map((folder) =>
      folder.parentId === id ? { ...folder, parentId } : folder,
    )
  const meetings = blob.meetings.map((meeting) => ({
    ...meeting,
    folderIds: (meeting.folderIds ?? []).filter((folderId) => folderId !== id),
  }))
  writeBlob({ ...blob, meetings, folders: nextFolders })
  return true
}

export function reorderFolders(
  orderedIds: string[],
  parentId: string | null,
): StoredFolder[] {
  const blob = readBlob()
  const parentKey = parentId
  const idSet = new Set(orderedIds)
  const siblings = blob.folders.filter((f) => (f.parentId ?? null) === parentKey)
  if (siblings.some((f) => !idSet.has(f.id)) || orderedIds.length !== siblings.length) {
    return listFolders()
  }
  const orderMap = new Map(orderedIds.map((id, index) => [id, index]))
  const nextFolders = blob.folders.map((folder) => {
    if ((folder.parentId ?? null) !== parentKey) return folder
    const sortOrder = orderMap.get(folder.id)
    return typeof sortOrder === 'number' ? { ...folder, sortOrder } : folder
  })
  writeBlob({ ...blob, folders: nextFolders })
  return listFolders()
}

export function setMeetingFolders(meetingId: string, folderIds: string[]): StoredMeeting | null {
  const valid = new Set(listFolders().map((f) => f.id))
  const unique = Array.from(new Set(folderIds.filter((id) => valid.has(id))))
  return updateMeeting(meetingId, { folderIds: unique })
}

export function setMeetingTags(meetingId: string, tags: string[]): StoredMeeting | null {
  return updateMeeting(meetingId, { tags: normalizeTags(tags) })
}

export function listAllTags(): string[] {
  return aggregateTags(readAll().map((meeting) => meeting.tags))
}

export function setMeetingTemplate(
  meetingId: string,
  templateId: MeetingTemplateId,
): StoredMeeting | null {
  return updateMeeting(meetingId, { templateId })
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

/** True when title still matches the auto timestamp for start/create/schedule. */
export function isAutoGeneratedMeetingTitle(
  meeting: Pick<StoredMeeting, 'title' | 'startedAt' | 'createdAt' | 'scheduledStart'>,
): boolean {
  const candidates = [meeting.startedAt, meeting.createdAt, meeting.scheduledStart].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  )
  if (candidates.length === 0) return false
  return candidates.some((at) => meeting.title === defaultTitle(at))
}

/** Fixed-id sample artifact so Home always has one post-meeting example. */
export const DEMO_ARTIFACT_MEETING_ID = 'demo-post-meeting-artifact'

export function ensureDemoArtifactMeeting(): { meeting: StoredMeeting | null; created: boolean } {
  const existing = getMeeting(DEMO_ARTIFACT_MEETING_ID)
  if (existing) return { meeting: existing, created: false }
  if (listDeletedMeetingIds().includes(DEMO_ARTIFACT_MEETING_ID)) {
    return { meeting: null, created: false }
  }

  const startedAt = Date.now() - 2 * 60 * 60 * 1000
  const endedAt = startedAt + 22 * 60 * 1000
  const meeting: StoredMeeting = {
    id: DEMO_ARTIFACT_MEETING_ID,
    title: 'Clarifi Home & Coming up redesign',
    createdAt: startedAt,
    updatedAt: endedAt,
    startedAt,
    endedAt,
    status: 'ready',
    userNotes:
      '- Prefer Coming up as a raised widget\n- Date chip in header: Coming up | Thu 23 Jul\n- Post-meeting should feel like Jamie tabs + Granola ask bar\n- Keep Clarifi blue only',
    speakerLabels: {
      'Speaker 1': 'Tayo',
      'Speaker 2': 'Sam',
    },
    speakerIdentities: {
      'Speaker 1': {
        displayName: 'Tayo',
        email: 'tayo@example.com',
        source: 'calendar',
      },
      'Speaker 2': {
        displayName: 'Sam',
        email: 'sam@clarifi.app',
        source: 'calendar',
      },
    },
    attendees: [
      { email: 'tayo@example.com', name: 'Tayo', self: true },
      { email: 'sam@clarifi.app', name: 'Sam', self: false },
    ],
    attendeeEmails: ['tayo@example.com', 'sam@clarifi.app'],
    folderIds: [],
    transcript: [
      {
        id: 't1',
        text: 'Coming up feels flat — I want it back as a widget with Coming up and the date on one line.',
        source: 'mic',
        speaker: 'Speaker 1',
        at: startedAt + 30_000,
      },
      {
        id: 't2',
        text: 'Got it. We can ship a card header and then build the post-meeting artifact with Summary, Transcript, Tasks, and My notes.',
        source: 'system',
        speaker: 'Speaker 2',
        at: startedAt + 75_000,
      },
      {
        id: 't3',
        text: 'Also add Ask this meeting at the bottom and a follow-up email action — Clarifi blue, not purple or lime.',
        source: 'mic',
        speaker: 'Speaker 1',
        at: startedAt + 140_000,
      },
      {
        id: 't4',
        text: 'Tasks should be a real checklist from action items. Speakers renameable in the transcript.',
        source: 'system',
        speaker: 'Speaker 2',
        at: startedAt + 200_000,
      },
    ],
    summary:
      'Aligned Clarifi Home Coming up as a widget header and locked a post-meeting artifact IA: Summary, Transcript, Tasks, My notes, plus a sticky Ask bar.',
    enhancedNotes: `## Summary
Clarifi will treat the post-meeting note as a first-class artifact: four tabs, structured AI sections, checklist Tasks, and a meeting-scoped Ask bar with follow-up email.

## Key points
- Coming up widget header: Coming up | date
- Tabs: Summary · Transcript · Tasks · My notes
- Sticky Ask this meeting + Write follow-up email
- Rename speakers from Transcript
- Clarifi blue only — no Jamie purple or Granola lime

## Decisions
- Ship Tasks as a local checklist first (no assignees/due dates yet)
- Defer audio Replay until recordings are stored
- Folders cover organization; tags stay later

## Action items
- Rebuild MeetingWorkspace tabs and Summary section renderer
- Add Tasks checklist with completedActionItems persistence
- Wire MeetingAskBar to chat:send with meeting scope
- Seed a demo artifact meeting for review`,
    actionItems: [
      'Rebuild MeetingWorkspace tabs and Summary section renderer',
      'Add Tasks checklist with completedActionItems persistence',
      'Wire MeetingAskBar to chat:send with meeting scope',
      'Seed a demo artifact meeting for review',
    ],
    completedActionItems: ['Seed a demo artifact meeting for review'],
  }

  upsertMeetingSnapshot(meeting)
  return { meeting, created: true }
}

