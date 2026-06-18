import {
  closeProactivePanel,
  clearProactiveContentHistory,
  exportDraftToGmail,
  handleClipboardCopy,
  runDraftGenerator,
  runExtractActionItems,
  runProactiveAction,
  runSummarise,
  runWritingTransform,
  summariseMeetingTranscript,
} from './featureHandlers'
import type { ProactiveDraftGoal, ProactiveDraftTone, ProactiveWritingMode } from './featureTypes'
import {
  dismissProactiveSuggestions,
  getCurrentProactiveSuggestions,
  getProactiveEngineState,
  getProactiveSettings,
  updateProactiveSettings,
} from './proactiveEngine'
import { readClipboardText } from './textExtraction'
import type { ProactiveSuggestedAction } from './types'

export async function handleProactiveIpc(channel: string, data: unknown): Promise<unknown> {
  switch (channel) {
    case 'proactive:status':
      return getProactiveEngineState()

    case 'proactive:settings-get':
      return { settings: getProactiveSettings() }

    case 'proactive:settings-update': {
      const payload = data as { settings?: Partial<ReturnType<typeof getProactiveSettings>> }
      if (!payload.settings) throw new Error('settings is required')
      return { settings: updateProactiveSettings(payload.settings) }
    }

    case 'proactive:enable':
      return {
        settings: updateProactiveSettings({ enabled: true }),
        state: getProactiveEngineState(),
      }

    case 'proactive:disable':
      dismissProactiveSuggestions()
      closeProactivePanel()
      return {
        settings: updateProactiveSettings({ enabled: false }),
        state: getProactiveEngineState(),
      }

    case 'proactive:suggestions-get':
      return { payload: getCurrentProactiveSuggestions() }

    case 'proactive:dismiss':
      dismissProactiveSuggestions()
      return { ok: true }

    case 'proactive:run-action': {
      const payload = data as { action?: ProactiveSuggestedAction }
      if (!payload.action) throw new Error('action is required')
      await runProactiveAction(payload.action)
      return { ok: true }
    }

    case 'proactive:panel-close':
      closeProactivePanel()
      return { ok: true }

    case 'proactive:writing-transform': {
      const payload = data as {
        text?: string
        mode?: ProactiveWritingMode
        customInstruction?: string
        requestId?: string
      }
      if (!payload.text?.trim()) throw new Error('text is required')
      return {
        panel: await runWritingTransform({
          text: payload.text,
          mode: payload.mode ?? 'rewrite',
          customInstruction: payload.customInstruction,
          requestId: payload.requestId,
        }),
      }
    }

    case 'proactive:summarise':
      return { panel: await runSummarise() }

    case 'proactive:extract-actions':
      return { panel: await runExtractActionItems() }

    case 'proactive:draft-generate': {
      const payload = data as {
        goal?: ProactiveDraftGoal
        tone?: ProactiveDraftTone
        requestId?: string
      }
      return {
        panel: await runDraftGenerator({
          goal: payload.goal ?? null,
          tone: payload.tone,
          requestId: payload.requestId,
        }),
      }
    }

    case 'proactive:draft-export-gmail': {
      const payload = data as { body?: string; subject?: string | null }
      if (!payload.body?.trim()) throw new Error('body is required')
      return exportDraftToGmail({ body: payload.body, subject: payload.subject })
    }

    case 'proactive:clipboard-get':
      return { text: readClipboardText() }

    case 'proactive:action-item-complete': {
      const payload = data as { id?: string }
      if (!payload.id) throw new Error('id is required')
      const { MemoryRepository } = await import('../memory/memoryRepository')
      return { item: MemoryRepository.completeActionItem(payload.id) }
    }

    case 'proactive:summarise-transcript': {
      const payload = data as { lines?: string[] }
      if (!Array.isArray(payload.lines)) throw new Error('lines is required')
      await summariseMeetingTranscript(payload.lines)
      return { ok: true }
    }

    case 'proactive:clear-history':
      return clearProactiveContentHistory()

    default:
      return undefined
  }
}

export function handleProactiveClipboardSuggestion(text: string): void {
  handleClipboardCopy(text)
}
