export const MAX_TEXT_ATTACHMENT_BYTES = 400_000
export const MAX_TEXT_EXTRACT_CHARS = 24_000

export const IMAGE_ATTACHMENT_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
])

export const TEXT_ATTACHMENT_MIMES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/pdf',
])

export type AttachmentKind = 'image' | 'text' | 'rejected'

export function classifyAttachmentMime(mime: string): AttachmentKind {
  if (IMAGE_ATTACHMENT_MIMES.has(mime)) return 'image'
  if (TEXT_ATTACHMENT_MIMES.has(mime)) return 'text'
  return 'rejected'
}

export function assertAttachmentSize(bytes: number, max = MAX_TEXT_ATTACHMENT_BYTES): boolean {
  return Number.isFinite(bytes) && bytes > 0 && bytes <= max
}

/** Extract readable text from UTF-8 payloads (txt/md/csv/json). PDF uses a lightweight latin1 scrape. */
export function extractAttachmentText(input: {
  mimeType: string
  bytes: Uint8Array
  fileName?: string
}): string | null {
  if (!assertAttachmentSize(input.bytes.byteLength)) return null
  const mime = input.mimeType
  if (mime === 'application/pdf') {
    const asLatin1 = Array.from(input.bytes, (b) => String.fromCharCode(b)).join('')
    const matches = asLatin1.match(/\((?:\\\)|[^)]){3,200}\)/g) ?? []
    const texts = matches
      .map((chunk) =>
        chunk
          .slice(1, -1)
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .trim(),
      )
      .filter((line) => /[A-Za-z0-9]/.test(line))
    const joined = texts.join('\n').trim()
    return joined ? joined.slice(0, MAX_TEXT_EXTRACT_CHARS) : null
  }
  if (
    mime === 'text/plain' ||
    mime === 'text/markdown' ||
    mime === 'text/csv' ||
    mime === 'application/json'
  ) {
    try {
      const text = new TextDecoder('utf-8', { fatal: false }).decode(input.bytes).trim()
      return text ? text.slice(0, MAX_TEXT_EXTRACT_CHARS) : null
    } catch {
      return null
    }
  }
  return null
}

export function packTextAttachmentsIntoMessage(
  message: string,
  attachments: Array<{ name: string; text: string }>,
  options?: { asMeetingContext?: boolean },
): string {
  if (attachments.length === 0) return message
  const asMeetingContext = Boolean(options?.asMeetingContext)
  const blocks = attachments.map((file) => {
    const label = asMeetingContext
      ? `Meeting context file (${file.name})`
      : `Attached file (${file.name})`
    return `${label}:\n${file.text.slice(0, MAX_TEXT_EXTRACT_CHARS)}`
  })
  const parts = [
    message.trim(),
    asMeetingContext
      ? 'The following files are additional context for this meeting. Use them when answering questions or completing tasks about this meeting.'
      : '',
    ...blocks,
  ]
  return parts.filter(Boolean).join('\n\n')
}
