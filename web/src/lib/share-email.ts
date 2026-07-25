/**
 * Transactional email when someone shares a meeting note by email.
 * Primary CTA opens the same public URL as Copy link: /share/{token}
 */

export type SharedNoteEmailParams = {
  email: string
  sharerName: string
  meetingTitle: string
  shareUrl: string
  attendeesCount?: number
  meetingWhen?: string | null
  marketingUrl?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '')}`
  return 'https://www.clarifiapp.com'
}

function sharerInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'C'
  return trimmed.charAt(0).toUpperCase()
}

function formatMeta(params: SharedNoteEmailParams): string {
  const parts: string[] = []
  if (params.meetingWhen?.trim()) parts.push(params.meetingWhen.trim())
  const count = params.attendeesCount ?? 0
  if (count > 0) {
    parts.push(`${count} attendee${count === 1 ? '' : 's'}`)
  }
  return parts.join(' · ')
}

export function sharedNoteEmailSubject(meetingTitle: string): string {
  const title = meetingTitle.trim() || 'Untitled meeting'
  return `📝 Notes for '${title}'`
}

export function buildSharedNoteEmailText(params: SharedNoteEmailParams): string {
  const sharer = params.sharerName.trim() || 'Someone'
  const title = params.meetingTitle.trim() || 'Untitled meeting'
  const meta = formatMeta(params)
  return [
    `${sharer} shared meeting notes with you.`,
    '',
    title,
    meta,
    '',
    `View note: ${params.shareUrl}`,
    '',
    'Clarifi turns your meeting notes into a clear recap you can share.',
    '',
    'If you did not expect this email, you can ignore it.',
  ]
    .filter((line, index, arr) => !(line === '' && arr[index - 1] === ''))
    .join('\n')
}

/** Granola-style card email; Clarifi blue CTA. Pure for unit tests. */
export function buildSharedNoteEmailHtml(params: SharedNoteEmailParams): string {
  const sharer = escapeHtml(params.sharerName.trim() || 'Someone')
  const title = escapeHtml(params.meetingTitle.trim() || 'Untitled meeting')
  const shareUrl = escapeHtml(params.shareUrl)
  const meta = escapeHtml(formatMeta(params))
  const marketingUrl = escapeHtml(params.marketingUrl || `${appBaseUrl()}/`)
  const initial = escapeHtml(sharerInitial(params.sharerName))

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:24px 12px;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <tr>
      <td style="padding:28px 28px 8px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#111827;">clarifi</td>
            <td align="right">
              <a href="${marketingUrl}" style="display:inline-block;padding:8px 14px;border-radius:999px;background:#f3f4f6;color:#111827;text-decoration:none;font-size:13px;font-weight:600;">Download Clarifi</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 28px 0;">
        <div style="width:36px;height:36px;border-radius:999px;background:#2b6cff;color:#fff;font-size:14px;font-weight:700;line-height:36px;text-align:center;">${initial}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 28px 8px;">
        <h1 style="margin:0;font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-0.03em;color:#111827;">${sharer} shared meeting notes with you.</h1>
        <p style="margin:12px 0 0;font-size:15px;line-height:1.5;color:#6b7280;">Clarifi turns your raw meeting notes into a clear recap.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 28px 8px;">
        <a href="${shareUrl}" style="display:inline-block;padding:14px 28px;border-radius:12px;background:#2b6cff;color:#ffffff;text-decoration:none;font-size:15px;font-weight:650;">View Note</a>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 28px 28px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f9fb;border-radius:12px;border:1px solid #eef0f3;">
          <tr>
            <td style="padding:18px 18px;">
              <div style="font-size:16px;font-weight:700;color:#111827;letter-spacing:-0.02em;">${title}</div>
              ${meta ? `<div style="margin-top:6px;font-size:13px;color:#6b7280;">${meta}</div>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <p style="max-width:520px;margin:16px auto 0;text-align:center;font-size:12px;color:#9ca3af;">If you did not expect this email, you can ignore it.</p>
</body>
</html>
  `.trim()
}

/**
 * Send share-note email via Resend when RESEND_API_KEY is set.
 * Throws when delivery cannot be completed so callers do not report a false success.
 */
export async function sendSharedNoteEmail(params: SharedNoteEmailParams): Promise<void> {
  const subject = sharedNoteEmailSubject(params.meetingTitle)
  const text = buildSharedNoteEmailText(params)
  const html = buildSharedNoteEmailHtml({
    ...params,
    marketingUrl: params.marketingUrl || `${appBaseUrl()}/`,
  })

  const apiKey = process.env.RESEND_API_KEY?.trim()
  const fromRaw = process.env.RESEND_FROM_EMAIL?.trim().replace(/^["']|["']$/g, '') || ''
  const from = fromRaw
    ? fromRaw.includes('<')
      ? fromRaw
      : `Clarifi <${fromRaw}>`
    : 'Clarifi <onboarding@resend.dev>'

  if (!apiKey) {
    console.error(
      `[share-note-email] RESEND_API_KEY unset — cannot email ${params.email}; view URL:`,
      params.shareUrl,
    )
    throw Object.assign(new Error('email_not_configured'), {
      code: 'email_not_configured',
      subject,
      text,
      shareUrl: params.shareUrl,
    })
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.email],
      subject,
      text,
      html,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error(
      `[share-note-email] Resend failed (${response.status}) for ${params.email}:`,
      detail || response.statusText,
    )
    let resendMessage = 'Could not send the invite email.'
    try {
      const parsed = JSON.parse(detail) as { message?: string }
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        resendMessage = parsed.message.trim()
      }
    } catch {
      // keep default
    }
    throw Object.assign(new Error('email_delivery_failed'), {
      code: 'email_delivery_failed',
      message: resendMessage,
      subject,
      text,
      shareUrl: params.shareUrl,
      detail: detail || response.statusText,
    })
  }
}
