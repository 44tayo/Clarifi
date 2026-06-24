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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendCommunityInviteEmail(params: InviteEmailParams): Promise<void> {
  const acceptUrl = `${appBaseUrl()}/community/accept?token=${encodeURIComponent(params.token)}`
  const safeCommunityName = escapeHtml(params.communityName)
  const apiKey = process.env.RESEND_API_KEY?.trim()

  if (!apiKey) {
    console.info('[community-invite] email not configured; accept URL:', acceptUrl)
    return
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim() || 'Clarifi <onboarding@resend.dev>'

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.email],
        subject: `You're invited to ${params.communityName} on Clarifi`,
        html: `
          <p>You've been invited to join <strong>${safeCommunityName}</strong> on Clarifi.</p>
          <p>Communities are available on Pro+. Accept your invite to share meeting recaps, transcripts, and notes with your team.</p>
          <p><a href="${acceptUrl}">Accept invite</a></p>
          <p>This link expires in 7 days.</p>
        `,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[community-invite] Resend failed:', text)
    }
  } catch (err) {
    console.error('[community-invite] send failed:', err)
  }
}
