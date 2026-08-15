/**
 * Calendar-backed pre-meeting brief assembler (history + attendees → structured brief).
 */

import { retrieveAndPack, type RetrievalMeeting } from './meetingRetrieval'

export type BriefCalendarEvent = {
  id: string
  title: string
  startAt: string
  endAt?: string
  attendeeEmails?: string[]
  meetingUrl?: string | null
}

export type BriefCitation = {
  meetingId: string
  title: string
  quote?: string
}

export type PreMeetingBrief = {
  eventTitle: string
  eventStartAt: string
  attendeeEmails: string[]
  goals: string[]
  openActions: string[]
  decisions: string[]
  suggestedQuestions: string[]
  citations: BriefCitation[]
  contextExcerpt: string
}

function domainFromEmail(email: string): string | null {
  const parts = email.toLowerCase().split('@')
  return parts.length === 2 ? parts[1]! : null
}

function extractBullets(text: string, labels: string[]): string[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const hits: string[] = []
  for (const line of lines) {
    const lower = line.toLowerCase()
    if (labels.some((label) => lower.includes(label))) {
      const cleaned = line.replace(/^[-*•\d.\s]+/, '').trim()
      if (cleaned) hits.push(cleaned.slice(0, 180))
    }
  }
  return [...new Set(hits)].slice(0, 6)
}

export function filterMeetingsForAttendees(
  meetings: RetrievalMeeting[],
  attendeeEmails: string[],
): RetrievalMeeting[] {
  const emails = new Set(attendeeEmails.map((email) => email.toLowerCase()))
  const domains = new Set(
    [...emails].map(domainFromEmail).filter((domain): domain is string => Boolean(domain)),
  )
  return meetings.filter((meeting) => {
    const meetingEmails = (meeting.attendeeEmails ?? []).map((email) => email.toLowerCase())
    if (meetingEmails.some((email) => emails.has(email))) return true
    if (
      meetingEmails.some((email) => {
        const domain = domainFromEmail(email)
        return domain ? domains.has(domain) : false
      })
    ) {
      return true
    }
    const blob = [meeting.title, meeting.enhancedNotes, meeting.summary, meeting.userNotes]
      .filter(Boolean)
      .join('\n')
      .toLowerCase()
    return (
      [...emails].some((email) => blob.includes(email)) ||
      [...domains].some((domain) => blob.includes(domain))
    )
  })
}

export function assemblePreMeetingBrief(input: {
  event: BriefCalendarEvent
  meetings: Array<
    RetrievalMeeting & {
      attendeeEmails?: string[]
    }
  >
  now?: number
}): PreMeetingBrief {
  const attendeeEmails = (input.event.attendeeEmails ?? []).map((email) => email.trim()).filter(Boolean)
  const related = filterMeetingsForAttendees(input.meetings, attendeeEmails)
  const query = [
    input.event.title,
    ...attendeeEmails,
    'decisions open actions follow-ups',
  ].join(' ')
  const { packed, hits } = retrieveAndPack(related.length > 0 ? related : input.meetings, query, {
    now: input.now,
    topK: 6,
  })
  const corpus = hits.map((hit) => hit.chunk.text).join('\n')
  const decisions = extractBullets(corpus, ['decision', 'agreed', 'decided'])
  const openActions = extractBullets(corpus, ['action', 'todo', 'follow up', 'next step', 'owner'])
  const goals = [
    `Prepare for ${input.event.title}`,
    ...(attendeeEmails.length
      ? [`Align with ${attendeeEmails.slice(0, 3).join(', ')}`]
      : ['Clarify agenda and desired outcomes']),
  ].slice(0, 4)

  const suggestedQuestions = [
    'What decisions are still open from our last conversation?',
    'Which action items are blocked or overdue?',
    'What does success look like for this meeting?',
    'Are there risks we should surface early?',
    'What should we follow up on after this call?',
  ]

  return {
    eventTitle: input.event.title,
    eventStartAt: input.event.startAt,
    attendeeEmails,
    goals,
    openActions: openActions.length > 0 ? openActions : ['No open actions found in prior notes.'],
    decisions: decisions.length > 0 ? decisions : ['No prior decisions recovered from notes.'],
    suggestedQuestions,
    citations: hits.slice(0, 5).map((hit) => ({
      meetingId: hit.chunk.meetingId,
      title: hit.chunk.title,
      quote: hit.chunk.text.slice(0, 120),
    })),
    contextExcerpt: packed.slice(0, 4000),
  }
}
