type InviteEmailParams = {
  email: string
  communityName: string
  token: string
}

function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '')}`
  return 'http://localhost:3000'
}

/**
 * Send invite email via Resend when RESEND_API_KEY is set.
 * Falls back to logging the accept URL so invites still work out-of-band.
 */
export async function sendCommunityInviteEmail(params: InviteEmailParams): Promise<void> {
  const acceptUrl = `${appBaseUrl()}/community/accept?token=${encodeURIComponent(params.token)}`
  const subject = `You're invited to "${params.communityName}" on Clarifi`
  const text = [
    `You've been invited to share notes in "${params.communityName}" on Clarifi.`,
    '',
    `Accept the invite: ${acceptUrl}`,
    '',
    'If you did not expect this email, you can ignore it.',
  ].join('\n')
  const html = `
    <p>You've been invited to share notes in <strong>${escapeHtml(params.communityName)}</strong> on Clarifi.</p>
    <p><a href="${acceptUrl}">Accept the invite</a></p>
    <p style="color:#6b7280;font-size:13px">If you did not expect this email, you can ignore it.</p>
  `.trim()

  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || 'Clarifi <invites@clarifiapp.com>'

  if (!apiKey) {
    console.info(
      `[community-invite] RESEND_API_KEY unset — invite for ${params.email} to "${params.communityName}"; accept URL:`,
      acceptUrl,
    )
    return
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
      `[community-invite] Resend failed (${response.status}) for ${params.email}:`,
      detail || response.statusText,
    )
    console.info(`[community-invite] fallback accept URL:`, acceptUrl)
    return
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
