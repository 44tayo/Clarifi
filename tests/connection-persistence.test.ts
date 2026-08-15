import { describe, expect, it } from 'vitest'

/**
 * Pure helpers mirroring the persistence rules we rely on for staying paired /
 * keeping calendar refresh tokens across app restarts.
 */

function resolveRefreshToken(
  incoming: string | undefined,
  existing: string | null | undefined,
): string | null {
  if (incoming) return incoming
  if (existing) return existing
  return null
}

function connectionStatusFromLocalState(input: {
  hasLocalCredentials: boolean
  apiOk: boolean
  apiPaired: boolean
  apiUnauthorized: boolean
  cachedProfile: { email?: string } | null
}): { paired: boolean; email?: string } {
  if (!input.hasLocalCredentials) return { paired: false }
  if (input.apiUnauthorized) return { paired: false }
  if (input.apiOk) {
    return input.apiPaired
      ? { paired: true, email: input.cachedProfile?.email }
      : { paired: false }
  }
  if (input.cachedProfile) return { paired: true, email: input.cachedProfile.email }
  return { paired: true }
}

describe('connection persistence rules', () => {
  it('keeps an existing calendar refresh token when provider omits a new one', () => {
    expect(resolveRefreshToken(undefined, 'existing-refresh')).toBe('existing-refresh')
    expect(resolveRefreshToken('new-refresh', 'existing-refresh')).toBe('new-refresh')
    expect(resolveRefreshToken('', 'existing-refresh')).toBe('existing-refresh')
    expect(resolveRefreshToken(undefined, null)).toBeNull()
  })

  it('stays paired when local credentials exist and the API is briefly unreachable', () => {
    expect(
      connectionStatusFromLocalState({
        hasLocalCredentials: true,
        apiOk: false,
        apiPaired: false,
        apiUnauthorized: false,
        cachedProfile: { email: 'tayo@example.com' },
      }),
    ).toEqual({ paired: true, email: 'tayo@example.com' })

    expect(
      connectionStatusFromLocalState({
        hasLocalCredentials: true,
        apiOk: false,
        apiPaired: false,
        apiUnauthorized: false,
        cachedProfile: null,
      }),
    ).toEqual({ paired: true })
  })

  it('unpairs only when local credentials are missing or the API rejects the device', () => {
    expect(
      connectionStatusFromLocalState({
        hasLocalCredentials: false,
        apiOk: false,
        apiPaired: false,
        apiUnauthorized: false,
        cachedProfile: { email: 'tayo@example.com' },
      }),
    ).toEqual({ paired: false })

    expect(
      connectionStatusFromLocalState({
        hasLocalCredentials: true,
        apiOk: false,
        apiPaired: false,
        apiUnauthorized: true,
        cachedProfile: { email: 'tayo@example.com' },
      }),
    ).toEqual({ paired: false })
  })
})
