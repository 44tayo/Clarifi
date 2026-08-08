import { describe, expect, it } from 'vitest'

import {
  assertAttachmentSize,
  classifyAttachmentMime,
  extractAttachmentText,
  MAX_TEXT_ATTACHMENT_BYTES,
  packTextAttachmentsIntoMessage,
} from '../shared/chatAttachments'

describe('chatAttachments', () => {
  it('rejects unsupported mime types', () => {
    expect(classifyAttachmentMime('application/zip')).toBe('rejected')
    expect(classifyAttachmentMime('image/png')).toBe('image')
    expect(classifyAttachmentMime('application/pdf')).toBe('text')
    expect(classifyAttachmentMime('text/plain')).toBe('text')
  })

  it('enforces size caps', () => {
    expect(assertAttachmentSize(12)).toBe(true)
    expect(assertAttachmentSize(MAX_TEXT_ATTACHMENT_BYTES + 1)).toBe(false)
    expect(assertAttachmentSize(0)).toBe(false)
  })

  it('extracts plain text into packed message', () => {
    const bytes = new TextEncoder().encode('Hello attachment world')
    const text = extractAttachmentText({ mimeType: 'text/plain', bytes, fileName: 'note.txt' })
    expect(text).toContain('Hello attachment world')
    const packed = packTextAttachmentsIntoMessage('Summarize this', [
      { name: 'note.txt', text: text! },
    ])
    expect(packed).toContain('Summarize this')
    expect(packed).toContain('Attached file (note.txt)')
    expect(packed).toContain('Hello attachment world')
  })

  it('labels meeting-context attachments for Ask', () => {
    const packed = packTextAttachmentsIntoMessage(
      'What did we decide?',
      [{ name: 'brief.pdf', text: 'Budget approved at $40k' }],
      { asMeetingContext: true },
    )
    expect(packed).toContain('additional context for this meeting')
    expect(packed).toContain('Meeting context file (brief.pdf)')
    expect(packed).toContain('Budget approved at $40k')
    expect(packed).not.toContain('Attached file (brief.pdf)')
  })

  it('returns null for oversized payloads', () => {
    const bytes = new Uint8Array(MAX_TEXT_ATTACHMENT_BYTES + 10)
    expect(extractAttachmentText({ mimeType: 'text/plain', bytes })).toBeNull()
  })
})
