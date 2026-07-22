import { getOutputLanguage } from './audioPreferences'
import { languageLabel } from './languages'
import { proxyMeetingChat } from './proxyClient'
import type { StoredMeeting } from './meetingStore'
import { updateMeeting } from './meetingStore'
import { resolveSpeakerDisplay } from './transcriptUtils'

function transcriptLines(meeting: StoredMeeting): string[] {
  const labels = meeting.speakerLabels ?? {}
  return meeting.transcript.map(
    (entry) => `${resolveSpeakerDisplay(entry.speaker, labels)}: ${entry.text}`,
  )
}

function buildEnhancePrompt(meeting: StoredMeeting): string {
  const notes = meeting.userNotes.trim() || '(no notes taken during the meeting)'
  const outputLanguage = getOutputLanguage()
  // parseEnhancedReply below matches on the literal English "## Summary" /
  // "## Action items" markers, so headers always stay in English even when
  // the user asks for notes in another language — only the body content
  // (and the language instruction appended below) changes.
  const languageNote =
    outputLanguage !== 'en'
      ? `\n\nKeep the section headers exactly as shown above (in English), but write all other content in ${languageLabel(outputLanguage)}.`
      : ''

  return [
    'Turn this meeting into polished notes for the user.',
    'Use markdown with these sections exactly:',
    '## Summary',
    '## Key points',
    '## Decisions',
    '## Action items',
    '',
    'Keep it concise and practical. Preserve specifics from the user notes.',
    'If the transcript is sparse, rely more on user notes.',
    languageNote,
    '',
    `Meeting title: ${meeting.title}`,
    '',
    'User notes during the meeting:',
    notes,
  ].join('\n')
}

export async function enhanceMeetingNotes(meetingId: string): Promise<StoredMeeting | null> {
  const meeting = updateMeeting(meetingId, { status: 'processing', enhanceError: undefined })
  if (!meeting) return null

  const result = await proxyMeetingChat({
    message: buildEnhancePrompt(meeting),
    transcriptLines: transcriptLines(meeting),
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
  return updateMeeting(meetingId, {
    status: 'ready',
    enhancedNotes: body,
    summary,
    actionItems,
    enhanceError: undefined,
  })
}

function parseEnhancedReply(reply: string): {
  summary?: string
  actionItems?: string[]
  body: string
} {
  const body = reply.trim()
  const summaryMatch = body.match(/## Summary\s*\n+([\s\S]*?)(?=\n## |\n*$)/i)
  const actionsMatch = body.match(/## Action items\s*\n+([\s\S]*?)(?=\n## |\n*$)/i)

  const summary = summaryMatch?.[1]?.trim()
  const actionItems = actionsMatch?.[1]
    ?.split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)

  return { summary, actionItems, body }
}
