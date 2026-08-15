import type { UserIdentity } from '@supabase/supabase-js'

export function readNameFromUserMetadata(
  metadata: Record<string, unknown> | undefined,
  email?: string | null,
): { firstName: string; lastName: string; displayName: string } {
  const meta = metadata ?? {}
  const firstName =
    (typeof meta.first_name === 'string' && meta.first_name) ||
    (typeof meta.given_name === 'string' && meta.given_name) ||
    ''
  const lastName =
    (typeof meta.last_name === 'string' && meta.last_name) ||
    (typeof meta.family_name === 'string' && meta.family_name) ||
    ''
  const displayName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    `${firstName} ${lastName}`.trim() ||
    email?.split('@')[0] ||
    'there'

  return { firstName, lastName, displayName }
}

export function getAccountAuthProviders(
  identities: UserIdentity[] | undefined,
  email?: string | null,
): { hasEmailAuth: boolean; hasGoogleAuth: boolean } {
  const providers = new Set(identities?.map((identity) => identity.provider) ?? [])
  if (providers.size === 0 && email) providers.add('email')

  return {
    hasEmailAuth: providers.has('email'),
    hasGoogleAuth: providers.has('google'),
  }
}
