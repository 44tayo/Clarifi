import { getSupabaseAdmin } from './supabase-admin'

export type ConnectedAccount = {
  provider: string
  label: string
  email?: string
}

export type DesktopUserProfile = {
  paired: boolean
  userId?: string
  email?: string
  firstName?: string
  lastName?: string
  fullName?: string
  avatarUrl?: string
  connectedAccounts?: ConnectedAccount[]
  plan?: string
  planLabel?: string
  sessionsToday?: number
  sessionsLimit?: number | null
}

function providerLabel(provider: string): string {
  if (provider === 'google') return 'Google'
  if (provider === 'email') return 'Email'
  return provider.charAt(0).toUpperCase() + provider.slice(1)
}

function readNameFromMetadata(metadata: Record<string, unknown> | undefined): {
  firstName: string
  lastName: string
  fullName: string
} {
  const meta = metadata ?? {}
  const firstName =
    (typeof meta.first_name === 'string' && meta.first_name) ||
    (typeof meta.given_name === 'string' && meta.given_name) ||
    ''
  const lastName =
    (typeof meta.last_name === 'string' && meta.last_name) ||
    (typeof meta.family_name === 'string' && meta.family_name) ||
    ''
  const fullName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    `${firstName} ${lastName}`.trim()

  return { firstName, lastName, fullName }
}

export async function getDesktopUserProfile(userId: string): Promise<DesktopUserProfile | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error || !data.user) return null

  const user = data.user
  const { firstName, lastName, fullName } = readNameFromMetadata(
    user.user_metadata as Record<string, unknown>,
  )
  const avatarUrl =
    (typeof user.user_metadata?.avatar_url === 'string' && user.user_metadata.avatar_url) ||
    (typeof user.user_metadata?.picture === 'string' && user.user_metadata.picture) ||
    undefined

  const connectedAccounts: ConnectedAccount[] = []
  const seen = new Set<string>()

  for (const identity of user.identities ?? []) {
    const provider = identity.provider
    if (!provider || seen.has(provider)) continue
    seen.add(provider)
    const identityEmail =
      typeof identity.identity_data?.email === 'string'
        ? identity.identity_data.email
        : undefined
    connectedAccounts.push({
      provider,
      label: providerLabel(provider),
      email: identityEmail ?? user.email ?? undefined,
    })
  }

  if (connectedAccounts.length === 0 && user.email) {
    connectedAccounts.push({
      provider: 'email',
      label: 'Email',
      email: user.email,
    })
  }

  return {
    paired: true,
    userId: user.id,
    email: user.email ?? undefined,
    firstName,
    lastName,
    fullName: fullName || user.email?.split('@')[0] || 'User',
    avatarUrl,
    connectedAccounts,
  }
}

export async function updateDesktopUserProfile(
  userId: string,
  input: { firstName: string; lastName: string },
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return { ok: false, error: 'storage_unavailable' }

  const { data, error: readError } = await supabase.auth.admin.getUserById(userId)
  if (readError || !data.user) return { ok: false, error: 'user_not_found' }

  const existingMeta = (data.user.user_metadata ?? {}) as Record<string, unknown>
  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  const fullName = `${firstName} ${lastName}`.trim()

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...existingMeta,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      name: fullName,
    },
  })

  if (error) return { ok: false, error: 'update_failed' }
  return { ok: true }
}
