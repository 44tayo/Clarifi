import fs from 'node:fs'
import path from 'node:path'

import { app } from 'electron'

export type ChatAuditEvent = {
  id: string
  at: number
  scope: string
  folderId?: string | null
  personEmail?: string | null
  company?: string | null
  meetingId?: string | null
  citationCount: number
  retrievalHitIds: string[]
  ok: boolean
  error?: string
}

const MAX_EVENTS = 200

function auditPath(): string {
  return path.join(app.getPath('userData'), 'chat-audit.json')
}

export function listChatAuditEvents(): ChatAuditEvent[] {
  try {
    const raw = fs.readFileSync(auditPath(), 'utf8')
    const parsed = JSON.parse(raw) as { events?: ChatAuditEvent[] }
    return Array.isArray(parsed.events) ? parsed.events : []
  } catch {
    return []
  }
}

export function appendChatAuditEvent(event: ChatAuditEvent): ChatAuditEvent[] {
  const events = [event, ...listChatAuditEvents()].slice(0, MAX_EVENTS)
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(auditPath(), JSON.stringify({ events }, null, 2), 'utf8')
  } catch (err) {
    console.error('Failed to persist chat audit', err)
  }
  return events
}

export function purgeChatAuditEvents(): void {
  try {
    if (fs.existsSync(auditPath())) fs.unlinkSync(auditPath())
  } catch (err) {
    console.error('Failed to purge chat audit', err)
  }
}
