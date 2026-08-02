import { getOutputLanguage } from './audioPreferences'
import { languageLabel } from './languages'
import { proxyMeetingChat } from './proxyClient'
import type { StoredMeeting } from './meetingStore'
import { updateMeeting } from './meetingStore'
import { resolveSpeakerDisplay } from './transcriptUtils'
import {
  extractActionItems,
  extractOverviewSummary,
} from '../shared/parseEnhancedNotes'

function transcriptLines(meeting: StoredMeeting): string[] {
  const labels = meeting.speakerLabels ?? {}
  return meeting.transcript.map(
    (entry) => `${resolveSpeakerDisplay(entry.speaker, labels)}: ${entry.text}`,
  )
}

function formatMeetingMeta(meeting: StoredMeeting): string {
  const parts: string[] = [`Meeting title: ${meeting.title}`]
  if (meeting.startedAt) {
    parts.push(`Date: ${new Date(meeting.startedAt).toISOString()}`)
  }
  if (meeting.startedAt && meeting.endedAt && meeting.endedAt > meeting.startedAt) {
    const minutes = Math.max(1, Math.round((meeting.endedAt - meeting.startedAt) / 60_000))
    parts.push(`Duration: ~${minutes} min`)
  }
  const speakers = Object.values(meeting.speakerLabels ?? {}).filter(Boolean)
  if (speakers.length > 0) {
    parts.push(`Speakers: ${speakers.join(', ')}`)
  }
  return parts.join('\n')
}

function buildEnhancePrompt(meeting: StoredMeeting): string {
  const notes = meeting.userNotes.trim() || '(no notes taken during the meeting)'
  const outputLanguage = getOutputLanguage()
  const languageNote =
    outputLanguage !== 'en'
      ? `\n\nKeep structural section headers in English (especially "# Next Steps"), but write all other content in ${languageLabel(outputLanguage)}.`
      : ''

  return [
    'Write a polished Enhanced meeting note from the transcript and user scratchpad below.',
    '',
    'Requirements:',
    '- Invent topical # Section headings from what was discussed (like a Granola Enhanced note) — do not force a fixed Overview / Key points / Decisions shell when richer topics fit.',
    '- Use nested markdown bullets (- and indented sub-bullets) with concrete specifics: names, numbers, dates, orgs, commitments.',
    '- Prefer the user scratchpad as the skeleton when present; fill gaps from the transcript. If the transcript is sparse, lean on user notes.',
    '- Optional insight callouts as markdown blockquotes (> ...) when advice or framing was given.',
    '- End with exactly: # Next Steps',
    '- Under Next Steps, list actionable bullets; bold the core action phrase with **...**.',
    '- Dense, specific, and scannable — not vague, padded, or a raw transcript dump.',
    languageNote,
    '',
    formatMeetingMeta(meeting),
    '',
    'User notes during the meeting (scratchpad):',
    notes,
  ].join('\n')
}

function mergeCompletedActionItems(
  previousCompleted: string[] | undefined,
  nextItems: string[],
): string[] {
  if (!previousCompleted?.length || nextItems.length === 0) return []
  const nextSet = new Set(nextItems.map((item) => item.toLowerCase()))
  return previousCompleted.filter((item) => nextSet.has(item.toLowerCase()))
}

export async function enhanceMeetingNotes(meetingId: string): Promise<StoredMeeting | null> {
  const meeting = updateMeeting(meetingId, { status: 'processing', enhanceError: undefined })
  if (!meeting) return null

  const result = await proxyMeetingChat({
    message: buildEnhancePrompt(meeting),
    transcriptLines: transcriptLines(meeting),
    purpose: 'enhance_notes',
  })

  if ('error' in result) {
    const enhanceError =
      result.error === 'network_error'
        ? 'network_error'
        : result.error === 'auth_expired' || result.error === 'not_authenticated'
          ? 'Connect your account to generate your AI summary.'
          : result.error
    return updateMeeting(meetingId, {
      status: 'error',
      enhanceError,
    })
  }

  const { summary, actionItems, body } = parseEnhancedReply(result.reply)
  const completedActionItems = mergeCompletedActionItems(
    meeting.completedActionItems,
    actionItems ?? [],
  )
  return updateMeeting(meetingId, {
    status: 'ready',
    enhancedNotes: body,
    summary,
    actionItems,
    completedActionItems,
    enhanceError: undefined,
  })
}

function parseEnhancedReply(reply: string): {
  summary?: string
  actionItems?: string[]
  body: string
} {
  const body = reply.trim()
  const actionItems = extractActionItems(body)
  const summary = extractOverviewSummary(body)
  return {
    summary,
    actionItems: actionItems.length > 0 ? actionItems : undefined,
    body,
  }
}
