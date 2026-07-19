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
 * Community invites are created in the database regardless of email delivery.
 * No outbound email provider is configured — invited users can still accept
 * via the accept URL if it's shared with them out of band.
 */
export async function sendCommunityInviteEmail(params: InviteEmailParams): Promise<void> {
  const acceptUrl = `${appBaseUrl()}/community/accept?token=${encodeURIComponent(params.token)}`
  console.info(
    `[community-invite] invite created for ${params.email} to "${params.communityName}"; accept URL:`,
    acceptUrl,
  )
}
