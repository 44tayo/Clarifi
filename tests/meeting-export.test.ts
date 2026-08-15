import { describe, expect, it } from 'vitest'

import { buildMarkdownExport } from '../electron/meetingExport'
import type { StoredMeeting } from '../electron/meetingStore'

function baseMeeting(overrides: Partial<StoredMeeting> = {}): StoredMeeting {
  return {
    id: 'm1',
    title: 'Design sync',
    createdAt: 1700000000000,
    status: 'ready',
    userNotes: '',
    transcript: [],
    ...overrides,
  }
}

describe('buildMarkdownExport', () => {
  it('includes title, date, and enhanced notes body', () => {
    const md = buildMarkdownExport(
      baseMeeting({ enhancedNotes: '## Summary\nShipped the export feature.' }),
    )
    expect(md).toContain('# Design sync')
    expect(md).toContain('## Summary')
    expect(md).toContain('Shipped the export feature.')
  })

  it('falls back to summary when enhancedNotes is missing', () => {
    const md = buildMarkdownExport(baseMeeting({ summary: 'Quick recap.' }))
    expect(md).toContain('## Summary')
    expect(md).toContain('Quick recap.')
  })

  it('renders action items as a markdown checklist with completion state', () => {
    const md = buildMarkdownExport(
      baseMeeting({
        actionItems: ['Ship export', 'Write tests'],
        completedActionItems: ['Ship export'],
      }),
    )
    expect(md).toContain('- [x] Ship export')
    expect(md).toContain('- [ ] Write tests')
  })

  it('includes attendees when present', () => {
    const md = buildMarkdownExport(
      baseMeeting({ attendeeEmails: ['a@example.com', 'b@example.com'] }),
    )
    expect(md).toContain('**Attendees:** a@example.com, b@example.com')
  })

  it('includes user notes and transcript with resolved speaker labels', () => {
    const md = buildMarkdownExport(
      baseMeeting({
        userNotes: 'Remember to follow up.',
        speakerLabels: { 'Speaker 1': 'Alex' },
        transcript: [{ id: 't1', text: 'Hello there', source: 'mic', speaker: 'Speaker 1', at: 0 }],
      }),
    )
    expect(md).toContain('## My notes')
    expect(md).toContain('Remember to follow up.')
    expect(md).toContain('## Transcript')
    expect(md).toContain('**Alex:** Hello there')
  })

  it('omits optional sections entirely when there is no content', () => {
    const md = buildMarkdownExport(baseMeeting())
    expect(md).not.toContain('## Action items')
    expect(md).not.toContain('## My notes')
    expect(md).not.toContain('## Transcript')
    expect(md).not.toContain('**Attendees:**')
  })
})
