import { randomUUID } from 'crypto'
import { BrowserWindow, shell } from 'electron'
import { MemoryRepository } from '../memory/memoryRepository'
import {
  CLARIFI_PROACTIVE_ACTION_ITEMS_PROMPT,
  CLARIFI_PROACTIVE_DRAFT_PROMPT,
  CLARIFI_PROACTIVE_SUMMARY_PROMPT,
  CLARIFI_PROACTIVE_WRITING_PROMPT,
} from './featurePrompts'
import type {
  ProactiveDraftGoal,
  ProactiveDraftTone,
  ProactiveExtractedActionItem,
  ProactivePanelPayload,
  ProactiveSummaryResult,
  ProactiveWritingMode,
} from './featureTypes'
import {
  completeProactiveJson,
  streamProactiveCompletion,
} from './proactiveLlm'
import {
  createProactiveRequestId,
  gatherProactiveContext,
  getRecentClipboardText,
} from './textExtraction'
import { getProactiveSettings } from './proactiveEngine'
import type { ProactiveSuggestedAction } from './types'

function broadcastPanel(payload: ProactivePanelPayload | null): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('proactive:panel-update', payload)
    }
  }
}

function broadcastClipboardSuggestion(text: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('proactive:clipboard-suggestion', {
        action_id: 'improve_writing',
        label: 'Improve writing',
        description: 'Rewrite copied text',
        priority: 'high',
        sourceText: text.slice(0, 2000),
      })
    }
  }
}

const WRITING_ACTION_IDS = new Set([
  'improve_writing',
  'rewrite',
  'polish_email',
  'make_formal',
  'make_shorter',
])

const SUMMARY_ACTION_IDS = new Set(['summarise_content', 'summarise_thread', 'summarise'])

const ACTION_ITEM_IDS = new Set(['extract_action_items', 'extract_actions'])

const DRAFT_ACTION_IDS = new Set([
  'draft_follow_up',
  'draft_email',
  'draft_slack',
  'draft_outreach',
])

function modeFromActionId(actionId: string): ProactiveWritingMode {
  if (actionId.includes('formal')) return 'formal'
  if (actionId.includes('shorter')) return 'shorten'
  if (actionId.includes('polish')) return 'grammar'
  return 'rewrite'
}

export async function runWritingTransform(input: {
  text: string
  mode: ProactiveWritingMode
  customInstruction?: string
  requestId?: string
}): Promise<ProactivePanelPayload | null> {
  const settings = getProactiveSettings()
  if (!settings.features.writingAssistant) return null

  const requestId = input.requestId ?? createProactiveRequestId()
  const instruction = input.customInstruction?.trim()
    ? `Custom instruction: ${input.customInstruction}`
    : `Mode: ${input.mode}`

  const result = await streamProactiveCompletion(
    requestId,
    CLARIFI_PROACTIVE_WRITING_PROMPT,
    `${instruction}\n\nText to rewrite:\n${input.text}`,
  )

  if (!result) return null

  const payload: ProactivePanelPayload = {
    kind: 'writing',
    sourceText: input.text,
    result,
    mode: input.mode,
  }
  broadcastPanel(payload)
  return payload
}

export async function runSummarise(input?: {
  text?: string
  requestId?: string
}): Promise<ProactivePanelPayload | null> {
  const settings = getProactiveSettings()
  if (!settings.features.autoSummarise) return null

  const ctx = input?.text ? { combinedText: input.text } : await gatherProactiveContext()
  const content = ctx.combinedText
  if (!content.trim()) return null

  const parsed = await completeProactiveJson<ProactiveSummaryResult>(
    CLARIFI_PROACTIVE_SUMMARY_PROMPT,
    content.slice(0, 20_000),
  )

  if (!parsed?.bullets) return null

  const result: ProactiveSummaryResult = {
    bullets: parsed.bullets ?? [],
    takeaway: parsed.takeaway ?? '',
    decisions: parsed.decisions ?? [],
    openQuestions: parsed.openQuestions ?? [],
    markdown: parsed.markdown ?? parsed.bullets.map((b) => `- ${b}`).join('\n'),
  }

  const payload: ProactivePanelPayload = { kind: 'summary', result }
  broadcastPanel(payload)
  await logSummaryToMemory(result)
  return payload
}

async function logSummaryToMemory(result: ProactiveSummaryResult): Promise<void> {
  try {
    const { MemoryService } = await import('../memory/MemoryService')
    MemoryService.upsertFactSync({
      category: 'work',
      key: 'proactive_summary',
      value: result.takeaway || result.bullets[0] || 'Summary saved',
      source: 'inferred',
      confidence: 0.8,
    })
  } catch {
    // ignore
  }
}

export async function runExtractActionItems(input?: {
  text?: string
}): Promise<ProactivePanelPayload | null> {
  const settings = getProactiveSettings()
  if (!settings.features.actionItems) return null

  const ctx = input?.text ? { combinedText: input.text } : await gatherProactiveContext()
  const content = ctx.combinedText
  if (!content.trim()) return null

  const parsed = await completeProactiveJson<{
    items?: Array<{
      text?: string
      owner?: string | null
      deadline?: string | null
      priority?: string
    }>
  }>(CLARIFI_PROACTIVE_ACTION_ITEMS_PROMPT, content.slice(0, 20_000))

  const items: ProactiveExtractedActionItem[] = (parsed?.items ?? [])
    .filter((i) => i.text?.trim())
    .map((i) => ({
      id: randomUUID(),
      text: String(i.text).trim(),
      owner: i.owner ?? null,
      deadline: i.deadline ?? null,
      priority: (['high', 'medium', 'low'].includes(String(i.priority))
        ? i.priority
        : 'medium') as ProactiveExtractedActionItem['priority'],
      completed: false,
    }))

  if (items.length === 0) return null

  const dbItems = MemoryRepository.createActionItems(
    null,
    items.map((i) => i.text),
    'proactive_extraction',
  )
  items.forEach((item, idx) => {
    if (dbItems[idx]) item.id = dbItems[idx].id
  })

  const payload: ProactivePanelPayload = { kind: 'action_items', items }
  broadcastPanel(payload)
  return payload
}

export async function runDraftGenerator(input: {
  goal?: ProactiveDraftGoal | null
  tone?: ProactiveDraftTone
  requestId?: string
}): Promise<ProactivePanelPayload | null> {
  const settings = getProactiveSettings()
  if (!settings.features.draftGenerator) return null

  const ctx = await gatherProactiveContext()
  const requestId = input.requestId ?? createProactiveRequestId()
  const tone = input.tone ?? 'professional'
  const goal = input.goal ?? 'follow_up'

  const result = await streamProactiveCompletion(
    requestId,
    CLARIFI_PROACTIVE_DRAFT_PROMPT,
    `Tone: ${tone}\nGoal: ${goal}\n\nContext:\n${ctx.combinedText.slice(0, 16_000)}`,
  )

  if (!result) return null

  const payload: ProactivePanelPayload = {
    kind: 'draft',
    text: result,
    tone,
    goal,
  }
  broadcastPanel(payload)
  await logDraftToMemory(result, tone, goal)
  return payload
}

async function logDraftToMemory(
  text: string,
  tone: ProactiveDraftTone,
  goal: ProactiveDraftGoal | null,
): Promise<void> {
  try {
    const { MemoryService } = await import('../memory/MemoryService')
    MemoryService.upsertFactSync({
      category: 'work',
      key: `proactive_draft_${Date.now()}`,
      value: `[${tone}/${goal ?? 'general'}] ${text.slice(0, 400)}`,
      source: 'proactive_draft',
      confidence: 0.85,
    })
  } catch {
    // ignore
  }
}

export async function runProactiveAction(action: ProactiveSuggestedAction): Promise<void> {
  const actionId = action.action_id.toLowerCase()

  if (WRITING_ACTION_IDS.has(actionId)) {
    const text = getRecentClipboardText() ?? ''
    if (!text) {
      const ctx = await gatherProactiveContext()
      const fallback = ctx.clipboardText ?? ctx.combinedText.slice(0, 4000)
      if (!fallback.trim()) return
      await runWritingTransform({ text: fallback, mode: modeFromActionId(actionId) })
      return
    }
    await runWritingTransform({ text, mode: modeFromActionId(actionId) })
    return
  }

  if (SUMMARY_ACTION_IDS.has(actionId)) {
    await runSummarise()
    return
  }

  if (ACTION_ITEM_IDS.has(actionId)) {
    await runExtractActionItems()
    return
  }

  if (DRAFT_ACTION_IDS.has(actionId)) {
    const goal: ProactiveDraftGoal = actionId.includes('slack')
      ? 'share_update'
      : actionId.includes('follow')
        ? 'follow_up'
        : 'follow_up'
    await runDraftGenerator({ goal })
    return
  }

  if (actionId === 'define_term') {
    const ctx = await gatherProactiveContext()
    const term = ctx.screenAnalysis?.detected_elements.find((e) =>
      e.toLowerCase().includes('term'),
    )
    await runWritingTransform({
      text: term ?? ctx.combinedText.slice(0, 500),
      mode: 'expand',
      customInstruction: 'Define this term clearly in 2-3 sentences for a professional',
    })
  }
}

export function handleClipboardCopy(text: string): void {
  const settings = getProactiveSettings()
  if (!settings.enabled || !settings.features.writingAssistant) return
  if (text.length < 12) return
  broadcastClipboardSuggestion(text)
}

export async function summariseMeetingTranscript(transcriptLines: string[]): Promise<void> {
  const settings = getProactiveSettings()
  if (!settings.features.autoSummarise) return
  if (transcriptLines.length === 0) return
  await runSummarise({ text: transcriptLines.join('\n') })
}

export function closeProactivePanel(): void {
  broadcastPanel(null)
}

function buildGmailComposeUrl(body: string, subject?: string | null): string {
  const params = new URLSearchParams({ view: 'cm', fs: '1', body })
  const trimmedSubject = subject?.trim()
  if (trimmedSubject) params.set('su', trimmedSubject)
  return `https://mail.google.com/mail/?${params.toString()}`
}

export async function exportDraftToGmail(input: {
  body: string
  subject?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const body = input.body?.trim()
  if (!body) return { ok: false, error: 'empty_draft' }

  try {
    await shell.openExternal(buildGmailComposeUrl(body, input.subject))
    return { ok: true }
  } catch {
    return { ok: false, error: 'open_failed' }
  }
}

export async function clearProactiveContentHistory(): Promise<{ ok: boolean }> {
  try {
    const { MemoryService } = await import('../memory/MemoryService')
    MemoryService.deleteSessionSync('proactive-screen-watch')
    MemoryService.deleteSessionSync('proactive-drafts')
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
