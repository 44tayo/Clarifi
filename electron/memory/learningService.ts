import { BrowserWindow } from 'electron'
import { CLARIFI_MEMORY_LEARNING_PROMPT } from '../prompts'
import { LEARNING_SESSION_INTERVAL } from './constants'
import { completeMemoryAnalysis, parseMemoryJson } from './memoryLlm'
import { MemoryRepository } from './memoryRepository'
import { MemoryService } from './MemoryService'
import type { LearningInsight, RecordSuggestionFeedbackInput } from './types'

let learningInProgress = false

export function recordSuggestionFeedback(input: RecordSuggestionFeedbackInput): void {
  const settings = MemoryService.getSettingsSync()
  if (!settings.adaptiveLearning) return
  MemoryRepository.recordSuggestionFeedback(input)
}

export async function maybeRunLearningAnalysis(): Promise<LearningInsight | null> {
  const settings = MemoryService.getSettingsSync()
  if (!settings.adaptiveLearning || learningInProgress) return null

  const completedSessions = MemoryRepository.countCompletedSessions()
  const lastRun = MemoryRepository.getLatestLearningRun()
  const sessionsSinceLast =
    lastRun == null
      ? completedSessions
      : Math.max(0, completedSessions - lastRun.sessionCount)

  if (sessionsSinceLast < LEARNING_SESSION_INTERVAL) return null

  learningInProgress = true
  try {
    const feedback = MemoryRepository.listRecentFeedback(50)
    if (feedback.length < 5) return null

    const profile = MemoryService.getUserProfileSync()
    const input = [
      'Recent suggestion feedback:',
      JSON.stringify(feedback, null, 2),
      '',
      'Current preference profile:',
      JSON.stringify(profile.preferenceProfile ?? {}, null, 2),
    ].join('\n')

    const text = await completeMemoryAnalysis(CLARIFI_MEMORY_LEARNING_PROMPT, input, 900)
    if (!text) return null

    const parsed = parseMemoryJson<{
      preferenceSummary?: string
      traits?: Record<string, unknown>
      promptAddendum?: string
    }>(text)
    if (!parsed?.preferenceSummary) return null

    const insights = {
      preferenceSummary: parsed.preferenceSummary,
      traits: parsed.traits ?? {},
      promptAddendum: parsed.promptAddendum ?? '',
      updatedAt: Date.now(),
    }

    MemoryService.updateUserProfileSync({
      communicationStyle: profile.communicationStyle,
      preferenceProfile: insights,
    })

    const run = MemoryRepository.saveLearningRun(completedSessions, insights)

    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('memory:learning-updated', {
          summary: parsed.preferenceSummary,
          traits: parsed.traits ?? {},
        })
      }
    }

    console.log('[memory] learning analysis complete')
    return run
  } catch (err) {
    console.error('[memory] learning analysis failed:', err)
    return null
  } finally {
    learningInProgress = false
  }
}

export function getLatestLearningInsight(): LearningInsight | null {
  return MemoryRepository.getLatestLearningRun()
}
