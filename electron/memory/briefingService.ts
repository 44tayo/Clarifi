import { randomUUID } from 'crypto'
import { BrowserWindow } from 'electron'
import { CLARIFI_MEMORY_BRIEFING_PROMPT } from '../prompts'
import { fetchTodayCalendarEvents, getCalendarStatus } from './calendarSync'
import { completeMemoryAnalysis, parseMemoryJson } from './memoryLlm'
import { MemoryRepository } from './memoryRepository'
import { MemoryService } from './MemoryService'
import type { DailyBriefingRecord } from './types'

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

function buildBriefingInput(): string {
  const profile = MemoryService.getUserProfileSync()
  const openItems = MemoryRepository.listOpenActionItems(12)
  const summaries = MemoryRepository.listRecentSummaries(5)
  const people = MemoryRepository.listPeople(undefined, 12)

  const calendarStatus = getCalendarStatus()
  const calendarNote = calendarStatus.connected
    ? 'Google Calendar is connected — today\'s events are included below.'
    : 'Google Calendar is not connected — omit calendar-specific sections or note that meetings are unavailable.'

  return [
    calendarNote,
    '',
    'User profile:',
    JSON.stringify(profile, null, 2),
    '',
    'Open action items:',
    openItems.length > 0 ? openItems.map((i) => `- ${i.text}`).join('\n') : '(none)',
    '',
    'Recent session summaries:',
    summaries.length > 0
      ? summaries.map((s) => `- ${s.summary}`).join('\n')
      : '(none yet)',
    '',
    'Known people:',
    people.length > 0
      ? people
          .map(
            (p) =>
              `- ${p.name}${p.company ? ` (${p.company})` : ''}${p.notes ? `: ${p.notes}` : ''}`,
          )
          .join('\n')
      : '(none yet)',
  ].join('\n')
}

export async function generateDailyBriefing(force = false): Promise<DailyBriefingRecord | null> {
  const settings = MemoryService.getSettingsSync()
  if (!settings.dailyBriefingEnabled && !force) return null

  const date = todayDateString()
  const existing = MemoryRepository.getBriefingForDate(date)
  if (existing && !force && existing.dismissedAt == null) {
    return existing
  }

  const calendarEvents = settings.calendarSyncEnabled ? await fetchTodayCalendarEvents() : []
  const input = [
    buildBriefingInput(),
    '',
    "Today's calendar events:",
    calendarEvents.length > 0
      ? JSON.stringify(calendarEvents, null, 2)
      : '(no events or calendar not connected)',
  ].join('\n')

  const text = await completeMemoryAnalysis(CLARIFI_MEMORY_BRIEFING_PROMPT, input, 1800)
  if (!text) return null

  const parsed = parseMemoryJson<{
    headline?: string
    sections?: Array<{ title?: string; bullets?: string[] }>
    markdown?: string
  }>(text)

  const markdown =
    parsed?.markdown?.trim() ||
    [
      parsed?.headline ? `# ${parsed.headline}` : '# Daily briefing',
      ...(parsed?.sections ?? []).flatMap((section) => [
        `\n## ${section.title ?? 'Update'}`,
        ...(section.bullets ?? []).map((b) => `- ${b}`),
      ]),
    ].join('\n')

  const record: DailyBriefingRecord = {
    id: existing?.id ?? randomUUID(),
    briefingDate: date,
    contentMarkdown: markdown,
    content: {
      headline: parsed?.headline ?? 'Daily briefing',
      sections: parsed?.sections ?? [],
      calendarEvents,
    },
    calendar: calendarEvents.length > 0 ? { events: calendarEvents } : null,
    generatedAt: Date.now(),
    dismissedAt: null,
    pinned: existing?.pinned ?? false,
  }

  MemoryRepository.upsertBriefing(record)
  MemoryService.updateSettingsSync({ lastBriefingGeneratedAt: record.generatedAt })

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('memory:briefing-ready', { briefing: record })
    }
  }

  console.log('[memory] daily briefing generated')
  return record
}

export async function maybeGenerateDailyBriefingOnLaunch(): Promise<void> {
  const settings = MemoryService.getSettingsSync()
  if (!settings.dailyBriefingEnabled) return

  const date = todayDateString()
  const existing = MemoryRepository.getBriefingForDate(date)
  if (existing) return

  setTimeout(() => {
    void generateDailyBriefing()
  }, 4000)
}

export function getLatestBriefing(): DailyBriefingRecord | null {
  return MemoryRepository.getLatestUndismissedBriefing()
}

export function dismissBriefing(date: string): void {
  MemoryRepository.dismissBriefing(date)
}

export function pinBriefing(date: string, pinned: boolean): void {
  MemoryRepository.pinBriefing(date, pinned)
}
