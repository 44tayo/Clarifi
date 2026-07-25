import { describe, expect, it } from 'vitest'

import {
  buildSharedNoteEmailHtml,
  buildSharedNoteEmailText,
  sharedNoteEmailSubject,
} from '../web/src/lib/share-email'
import { shareUrlForToken } from '../web/src/lib/share-link'

describe('shared note invite email', () => {
  const shareUrl = shareUrlForToken('tok_abc', 'https://www.clarifiapp.com')

  it('uses the same /share/{token} URL as Copy link in subject-adjacent body', () => {
    expect(shareUrl).toBe('https://www.clarifiapp.com/share/tok_abc')

    const text = buildSharedNoteEmailText({
      email: 'friend@example.com',
      sharerName: 'Tayo',
      meetingTitle: 'Design sync',
      shareUrl,
      attendeesCount: 2,
      meetingWhen: 'Sat, Jul 25',
    })

    expect(text).toContain('Tayo shared meeting notes with you.')
    expect(text).toContain('View note: https://www.clarifiapp.com/share/tok_abc')
    expect(text).toContain('Design sync')
  })

  it('builds HTML with View Note CTA pointing at the public share URL', () => {
    const html = buildSharedNoteEmailHtml({
      email: 'friend@example.com',
      sharerName: 'Tayo',
      meetingTitle: "Get started with Clarifi",
      shareUrl,
      attendeesCount: 2,
      meetingWhen: 'Wed, Jul 8',
      marketingUrl: 'https://www.clarifiapp.com/',
    })

    expect(sharedNoteEmailSubject("Get started with Clarifi")).toBe(
      "📝 Notes for 'Get started with Clarifi'",
    )
    expect(html).toContain('href="https://www.clarifiapp.com/share/tok_abc"')
    expect(html).toContain('View Note')
    expect(html).toContain('Tayo shared meeting notes with you.')
    expect(html).toContain('Get started with Clarifi')
    expect(html).toContain('Wed, Jul 8 · 2 attendees')
    expect(html).toContain('#2b6cff')
  })

  it('escapes HTML in sharer and title', () => {
    const html = buildSharedNoteEmailHtml({
      email: 'a@b.com',
      sharerName: 'A <script>',
      meetingTitle: 'Notes & "recap"',
      shareUrl: 'https://www.clarifiapp.com/share/x',
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('A &lt;script&gt;')
    expect(html).toContain('Notes &amp; &quot;recap&quot;')
  })
})
