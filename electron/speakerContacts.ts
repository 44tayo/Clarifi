import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export type LocalSpeakerContact = {
  displayName: string
  email?: string
  updatedAt: number
}

const FILE = 'speaker-contacts.json'
const MAX_CONTACTS = 200

function storePath(): string {
  return path.join(app.getPath('userData'), FILE)
}

function normalizeKey(contact: { displayName: string; email?: string }): string {
  const email = contact.email?.trim().toLowerCase()
  if (email) return `email:${email}`
  return `name:${contact.displayName.trim().toLowerCase()}`
}

export function listLocalSpeakerContacts(): LocalSpeakerContact[] {
  try {
    const raw = fs.readFileSync(storePath(), 'utf-8')
    const parsed = JSON.parse(raw) as { contacts?: LocalSpeakerContact[] }
    const contacts = Array.isArray(parsed.contacts) ? parsed.contacts : []
    return contacts
      .filter((c) => typeof c?.displayName === 'string' && c.displayName.trim())
      .map((c) => ({
        displayName: c.displayName.trim(),
        email: typeof c.email === 'string' && c.email.trim() ? c.email.trim() : undefined,
        updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : 0,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt || a.displayName.localeCompare(b.displayName))
  } catch {
    return []
  }
}

function saveContacts(contacts: LocalSpeakerContact[]): void {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(storePath(), JSON.stringify({ contacts }, null, 2))
  } catch (err) {
    console.error('Failed to save speaker contacts:', err)
  }
}

export function upsertLocalSpeakerContact(input: {
  displayName: string
  email?: string
}): LocalSpeakerContact | null {
  const displayName = input.displayName?.trim()
  if (!displayName) return null
  const email = input.email?.trim() || undefined
  const next: LocalSpeakerContact = {
    displayName,
    email,
    updatedAt: Date.now(),
  }
  const key = normalizeKey(next)
  const existing = listLocalSpeakerContacts().filter((c) => normalizeKey(c) !== key)
  existing.unshift(next)
  saveContacts(existing.slice(0, MAX_CONTACTS))
  return next
}
