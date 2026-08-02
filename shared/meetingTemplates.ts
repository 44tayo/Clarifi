/**
 * Meeting-type "recipes" that change how the AI structures the post-meeting
 * summary. Every template keeps the `## Summary` and `## Action items`
 * headers so `parseEnhancedReply` (electron/noteEnhance.ts) can keep
 * extracting those two fields the same way regardless of template.
 */
export type MeetingTemplateId = 'general' | 'sales' | 'one_on_one' | 'standup' | 'interview'

export type MeetingTemplate = {
  id: MeetingTemplateId
  label: string
  description: string
  sections: string[]
}

export const MEETING_TEMPLATES: MeetingTemplate[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Balanced summary for any meeting',
    sections: ['## Summary', '## Key points', '## Decisions', '## Action items'],
  },
  {
    id: 'sales',
    label: 'Sales call',
    description: 'Pain points, objections, next steps',
    sections: [
      '## Summary',
      '## Pain points & needs',
      '## Objections',
      '## Budget & timeline',
      '## Next steps',
      '## Action items',
    ],
  },
  {
    id: 'one_on_one',
    label: '1:1',
    description: 'Wins, blockers, growth talk',
    sections: [
      '## Summary',
      '## Wins & highlights',
      '## Challenges & blockers',
      '## Growth & development',
      '## Action items',
    ],
  },
  {
    id: 'standup',
    label: 'Standup',
    description: 'Yesterday, today, blockers',
    sections: ['## Summary', '## Yesterday', '## Today', '## Blockers', '## Action items'],
  },
  {
    id: 'interview',
    label: 'Interview',
    description: 'Strengths, concerns, recommendation',
    sections: [
      '## Summary',
      '## Candidate strengths',
      '## Concerns',
      '## Recommendation',
      '## Action items',
    ],
  },
]

export function normalizeMeetingTemplateId(value: unknown): MeetingTemplateId {
  return MEETING_TEMPLATES.some((template) => template.id === value)
    ? (value as MeetingTemplateId)
    : 'general'
}

export function getMeetingTemplate(id: MeetingTemplateId): MeetingTemplate {
  return MEETING_TEMPLATES.find((template) => template.id === id) ?? MEETING_TEMPLATES[0]!
}
