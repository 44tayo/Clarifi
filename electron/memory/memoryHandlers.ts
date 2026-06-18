import { shell } from 'electron'
import {
  buildMemoryContextBlock,
  buildPreSessionContext,
  buildRelationshipCards,
  extractNamesFromTranscript,
} from './contextManager'
import {
  dismissBriefing,
  generateDailyBriefing,
  getLatestBriefing,
  pinBriefing,
} from './briefingService'
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  fetchTodayCalendarEvents,
  getCalendarStatus,
} from './calendarSync'
import { clearAllMemoryData, exportMemoryToFile, applyRetentionPolicy } from './exportService'
import { getLatestLearningInsight, recordSuggestionFeedback } from './learningService'
import { MemoryRepository } from './memoryRepository'
import { MemoryService } from './MemoryService'
import type {
  KnowledgeCategory,
  RecordSuggestionFeedbackInput,
  UpsertKnowledgeFactInput,
  UpdateMemorySettingsInput,
  UpdateUserProfileInput,
  UpsertPersonInput,
} from './types'

export async function handleMemoryIpc(channel: string, data: unknown): Promise<unknown> {
  switch (channel) {
    case 'memory:settings-get':
      return { settings: MemoryService.getSettingsSync() }

    case 'memory:settings-update': {
      const payload = data as { settings?: UpdateMemorySettingsInput }
      if (!payload.settings) throw new Error('settings is required')
      return { settings: MemoryService.updateSettingsSync(payload.settings) }
    }

    case 'memory:profile-get':
      return { profile: MemoryService.getUserProfileSync() }

    case 'memory:profile-update': {
      const payload = data as { profile?: UpdateUserProfileInput }
      if (!payload.profile) throw new Error('profile is required')
      return { profile: MemoryService.updateUserProfileSync(payload.profile) }
    }

    case 'memory:facts-list': {
      const payload = data as { category?: KnowledgeCategory }
      return { facts: MemoryService.listFactsSync(payload.category) }
    }

    case 'memory:fact-upsert': {
      const payload = data as { fact?: UpsertKnowledgeFactInput }
      if (!payload.fact?.value) throw new Error('fact is required')
      return {
        fact: MemoryService.upsertFactSync({
          ...payload.fact,
          source: payload.fact.source ?? 'manual',
        }),
      }
    }

    case 'memory:fact-delete': {
      const payload = data as { id?: string }
      if (!payload.id) throw new Error('id is required')
      MemoryService.deleteFactSync(payload.id)
      return { ok: true }
    }

    case 'memory:people-list': {
      const payload = data as { query?: string }
      return { people: MemoryRepository.listPeople(payload.query) }
    }

    case 'memory:people-upsert': {
      const payload = data as { person?: UpsertPersonInput }
      if (!payload.person?.name) throw new Error('person is required')
      return { person: MemoryRepository.upsertPerson(payload.person) }
    }

    case 'memory:people-update': {
      const payload = data as { id?: string; person?: Partial<UpsertPersonInput> }
      if (!payload.id || !payload.person) throw new Error('id and person are required')
      const person = MemoryRepository.updatePerson(payload.id, payload.person)
      if (!person) throw new Error('person not found')
      return { person }
    }

    case 'memory:people-delete': {
      const payload = data as { id?: string }
      if (!payload.id) throw new Error('id is required')
      MemoryRepository.deletePerson(payload.id)
      return { ok: true }
    }

    case 'memory:pre-session-context': {
      const payload = data as { hints?: string[]; attendeeNames?: string[] }
      return { context: buildPreSessionContext(payload) }
    }

    case 'memory:relationship-cards': {
      const payload = data as { names?: string[]; transcriptLines?: string[] }
      const names = [
        ...(payload.names ?? []),
        ...(payload.transcriptLines ? extractNamesFromTranscript(payload.transcriptLines) : []),
      ]
      return { cards: buildRelationshipCards([...new Set(names)]) }
    }

    case 'memory:action-items-list':
      return { items: MemoryRepository.listOpenActionItems(50) }

    case 'memory:action-item-complete': {
      const payload = data as { id?: string }
      if (!payload.id) throw new Error('id is required')
      return { item: MemoryRepository.completeActionItem(payload.id) }
    }

    case 'memory:briefing-get':
      return { briefing: getLatestBriefing() }

    case 'memory:briefing-generate':
      return { briefing: await generateDailyBriefing(true) }

    case 'memory:briefing-dismiss': {
      const payload = data as { date?: string }
      if (!payload.date) throw new Error('date is required')
      dismissBriefing(payload.date)
      return { ok: true }
    }

    case 'memory:briefing-pin': {
      const payload = data as { date?: string; pinned?: boolean }
      if (!payload.date) throw new Error('date is required')
      pinBriefing(payload.date, Boolean(payload.pinned))
      return { ok: true }
    }

    case 'memory:calendar-status':
      return getCalendarStatus()

    case 'memory:calendar-connect':
      return await connectGoogleCalendar()

    case 'memory:calendar-disconnect':
      disconnectGoogleCalendar()
      return { ok: true, status: getCalendarStatus() }

    case 'memory:calendar-events-today':
      return { events: await fetchTodayCalendarEvents() }

    case 'memory:feedback-record': {
      const payload = data as RecordSuggestionFeedbackInput
      if (!payload.originalText || !payload.outcome) throw new Error('invalid feedback')
      recordSuggestionFeedback(payload)
      return { ok: true }
    }

    case 'memory:learning-latest':
      return { insight: getLatestLearningInsight() }

    case 'memory:export': {
      const path = exportMemoryToFile()
      void shell.showItemInFolder(path)
      return { ok: true, path }
    }

    case 'memory:clear-all':
      clearAllMemoryData()
      return { ok: true }

    case 'memory:apply-retention':
      return { deleted: applyRetentionPolicy() }

    default:
      return undefined
  }
}

export function getMemoryContextForPrompt(options: {
  queryText?: string
  attendeeNames?: string[]
  company?: string
}): string {
  return buildMemoryContextBlock(options)
}
