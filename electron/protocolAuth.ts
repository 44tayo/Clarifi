import { randomBytes, randomUUID } from 'crypto'
import fetch from 'node-fetch'
import { getClarifiApiUrl } from './keys'
import { saveKey } from './store'

const DEVICE_ID_KEY = 'device_id'
const DEVICE_SECRET_KEY = 'device_secret'

let pendingAuthUrl: string | null = null

export function queueAuthUrl(url: string): void {
  pendingAuthUrl = url
}

export function takePendingAuthUrl(): string | null {
  const url = pendingAuthUrl
  pendingAuthUrl = null
  return url
}

export type DesktopAuthProvider = 'google' | 'azure' | 'email'

export function getConnectPageUrl(): string {
  const base = getClarifiApiUrl()
  if (!base) return 'http://localhost:3000/desktop/connect'
  return `${base.replace(/\/$/, '')}/desktop/connect`
}

export function getSignInUrl(provider?: DesktopAuthProvider): string {
  const base = getClarifiApiUrl()
  const origin = base ? base.replace(/\/$/, '') : 'http://localhost:3000'
  if (!provider || provider === 'email') {
    return `${origin}/desktop/sign-in`
  }
  const params = new URLSearchParams({
    provider,
    next: '/desktop/connect',
  })
  return `${origin}/desktop/auth?${params.toString()}`
}

export function getBillingUrl(): string {
  const base = getClarifiApiUrl()
  if (!base) return 'http://localhost:3000/billing'
  return `${base.replace(/\/$/, '')}/billing`
}

export function getDashboardUrl(): string {
  const base = getClarifiApiUrl()
  if (!base) return 'http://localhost:3000/dashboard'
  return `${base.replace(/\/$/, '')}/dashboard`
}

export function getTermsUrl(): string {
  const base = getClarifiApiUrl()
  if (!base) return 'http://localhost:3000/terms'
  return `${base.replace(/\/$/, '')}/terms`
}

export function getPrivacyUrl(): string {
  const base = getClarifiApiUrl()
  if (!base) return 'http://localhost:3000/privacy'
  return `${base.replace(/\/$/, '')}/privacy`
}

function parseAuthToken(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'clarifi:') return null
    if (parsed.hostname !== 'auth' && parsed.pathname !== '//auth') {
      const hostAndPath = `${parsed.hostname}${parsed.pathname}`
      if (!hostAndPath.includes('auth')) return null
    }
    return parsed.searchParams.get('token')
  } catch {
    return null
  }
}

export async function exchangeAuthToken(
  authUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = parseAuthToken(authUrl)
  if (!token) return { ok: false, error: 'invalid_auth_url' }

  const baseUrl = getClarifiApiUrl()
  if (!baseUrl) return { ok: false, error: 'api_url_missing' }

  const deviceId = randomUUID()
  const deviceSecret = randomBytes(32).toString('base64url')

  try {
    const response = await fetch(`${baseUrl}/api/desktop/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, deviceId, deviceSecret }),
    })

    const data = (await response.json()) as { ok?: boolean; error?: string }
    if (!response.ok || !data.ok) {
      return { ok: false, error: data.error || 'exchange_failed' }
    }

    await saveKey(DEVICE_ID_KEY, deviceId)
    await saveKey(DEVICE_SECRET_KEY, deviceSecret)
    return { ok: true }
  } catch {
    return { ok: false, error: 'exchange_failed' }
  }
}
