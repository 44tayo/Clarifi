import { BrowserWindow, dialog } from 'electron'
import * as fs from 'fs'

import { getMeeting, type StoredMeeting } from './meetingStore'
import { resolveSpeakerDisplay } from './transcriptUtils'

export type ExportFormat = 'markdown' | 'pdf'

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim()
  return cleaned || 'Untitled meeting'
}

function formatMeetingDate(meeting: StoredMeeting): string {
  const at = meeting.startedAt ?? meeting.scheduledStart ?? meeting.createdAt
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(at),
  )
}

/** Builds the meeting's exportable Markdown — same content whether saved as .md or rendered to PDF. */
export function buildMarkdownExport(meeting: StoredMeeting): string {
  const lines: string[] = [`# ${meeting.title}`, '', `_${formatMeetingDate(meeting)}_`]

  const attendees = (meeting.attendeeEmails ?? []).filter(Boolean)
  if (attendees.length > 0) {
    lines.push('', `**Attendees:** ${attendees.join(', ')}`)
  }

  const body = meeting.enhancedNotes?.trim()
  if (body) {
    lines.push('', body)
  } else if (meeting.summary?.trim()) {
    lines.push('', '## Summary', meeting.summary.trim())
  }

  if (meeting.actionItems && meeting.actionItems.length > 0) {
    const completed = new Set(meeting.completedActionItems ?? [])
    lines.push(
      '',
      '## Action items',
      ...meeting.actionItems.map((item) => `- [${completed.has(item) ? 'x' : ' '}] ${item}`),
    )
  }

  if (meeting.userNotes.trim()) {
    lines.push('', '## My notes', meeting.userNotes.trim())
  }

  if (meeting.transcript.length > 0) {
    const labels = meeting.speakerLabels ?? {}
    lines.push(
      '',
      '## Transcript',
      ...meeting.transcript.map(
        (entry) => `**${resolveSpeakerDisplay(entry.speaker, labels)}:** ${entry.text}`,
      ),
    )
  }

  return `${lines.join('\n').trim()}\n`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Renders the same content as buildMarkdownExport, but as simple print-ready HTML for the PDF path. */
function buildExportHtml(meeting: StoredMeeting): string {
  const attendees = (meeting.attendeeEmails ?? []).filter(Boolean)
  const body = meeting.enhancedNotes?.trim()
  const sections: string[] = []

  if (body) {
    const htmlBody = body
      .split(/\n{2,}/)
      .map((block) => {
        const trimmed = block.trim()
        const headingMatch = trimmed.match(/^##\s+(.+)$/)
        if (headingMatch) return `<h2>${escapeHtml(headingMatch[1]!)}</h2>`
        if (/^[-*]\s+/.test(trimmed)) {
          const items = trimmed
            .split('\n')
            .map((line) => `<li>${escapeHtml(line.replace(/^[-*]\s*/, ''))}</li>`)
            .join('')
          return `<ul>${items}</ul>`
        }
        return `<p>${escapeHtml(trimmed).replace(/\n/g, '<br/>')}</p>`
      })
      .join('\n')
    sections.push(htmlBody)
  } else if (meeting.summary?.trim()) {
    sections.push(`<h2>Summary</h2><p>${escapeHtml(meeting.summary.trim())}</p>`)
  }

  if (meeting.actionItems && meeting.actionItems.length > 0) {
    const completed = new Set(meeting.completedActionItems ?? [])
    const items = meeting.actionItems
      .map(
        (item) =>
          `<li><input type="checkbox" disabled ${completed.has(item) ? 'checked' : ''}/> ${escapeHtml(item)}</li>`,
      )
      .join('')
    sections.push(`<h2>Action items</h2><ul class="checklist">${items}</ul>`)
  }

  if (meeting.userNotes.trim()) {
    sections.push(
      `<h2>My notes</h2><p>${escapeHtml(meeting.userNotes.trim()).replace(/\n/g, '<br/>')}</p>`,
    )
  }

  if (meeting.transcript.length > 0) {
    const labels = meeting.speakerLabels ?? {}
    const lines = meeting.transcript
      .map(
        (entry) =>
          `<p><strong>${escapeHtml(resolveSpeakerDisplay(entry.speaker, labels))}:</strong> ${escapeHtml(entry.text)}</p>`,
      )
      .join('')
    sections.push(`<h2>Transcript</h2>${lines}`)
  }

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; padding: 24px 32px; line-height: 1.5; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 16px; margin-top: 24px; margin-bottom: 8px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 16px; }
  ul { padding-left: 20px; }
  ul.checklist { list-style: none; padding-left: 0; }
  ul.checklist li { margin-bottom: 4px; }
  p { margin: 6px 0; font-size: 14px; }
</style>
</head>
<body>
  <h1>${escapeHtml(meeting.title)}</h1>
  <div class="meta">
    ${escapeHtml(formatMeetingDate(meeting))}
    ${attendees.length > 0 ? ` · ${escapeHtml(attendees.join(', '))}` : ''}
  </div>
  ${sections.join('\n')}
</body>
</html>`
}

async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true },
  })
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return await win.webContents.printToPDF({ printBackground: true })
  } finally {
    win.destroy()
  }
}

export async function exportMeetingToFile(
  meetingId: string,
  format: ExportFormat,
): Promise<{ ok: boolean; error?: string; path?: string }> {
  const meeting = getMeeting(meetingId)
  if (!meeting) return { ok: false, error: 'meeting_not_found' }

  const baseName = sanitizeFilename(meeting.title)
  const ext = format === 'pdf' ? 'pdf' : 'md'
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export meeting notes',
    defaultPath: `${baseName}.${ext}`,
    filters: [
      format === 'pdf'
        ? { name: 'PDF', extensions: ['pdf'] }
        : { name: 'Markdown', extensions: ['md'] },
    ],
  })
  if (canceled || !filePath) return { ok: false, error: 'cancelled' }

  try {
    if (format === 'markdown') {
      fs.writeFileSync(filePath, buildMarkdownExport(meeting), 'utf-8')
    } else {
      const pdfBuffer = await renderHtmlToPdf(buildExportHtml(meeting))
      fs.writeFileSync(filePath, pdfBuffer)
    }
    return { ok: true, path: filePath }
  } catch (error) {
    console.error('[export]', error)
    return { ok: false, error: 'write_failed' }
  }
}
