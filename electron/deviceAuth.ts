import fetch from 'node-fetch'

import { getClarifiApiUrl } from './keys'
import { getKey } from './store'
import { exchangeAuthToken, getConnectPageUrl } from './protocolAuth'

const DEVICE_ID_KEY = 'device_id'
const DEVICE_SECRET_KEY = 'device_secret'

export async function getDeviceCredentials(): Promise<{
  deviceId: string
  deviceSecret: string
} | null> {
  const deviceId = await getKey(DEVICE_ID_KEY)
  const deviceSecret = await getKey(DEVICE_SECRET_KEY)
  if (!deviceId || !deviceSecret) return null
  return { deviceId, deviceSecret }
}

export type DeviceProfile = {
  paired: boolean
  userId?: string
  email?: string
  firstName?: string
  lastName?: string
  fullName?: string
  plan?: string
  planLabel?: string
  entitlements?: string[]
}

export async function fetchDeviceProfile(): Promise<DeviceProfile> {
  const creds = await getDeviceCredentials()
  const baseUrl = getClarifiApiUrl()
  if (!creds || !baseUrl) return { paired: false }

  try {
    const response = await fetch(`${baseUrl}/api/desktop/profile`, {
      headers: {
        'X-Clarifi-Device-Id': creds.deviceId,
        'X-Clarifi-Device-Secret': creds.deviceSecret,
      },
    })
    if (!response.ok) return { paired: false }
    const data = (await response.json()) as DeviceProfile
    return { ...data, paired: Boolean(data.paired) }
  } catch {
    return { paired: false }
  }
}

export async function hasLocalDeviceCredentials(): Promise<boolean> {
  const creds = await getDeviceCredentials()
  return creds !== null
}

let profileCache: { profile: DeviceProfile; fetchedAt: number } | null = null
const PROFILE_CACHE_TTL_MS = 60 * 1000

export function invalidateDeviceProfileCache(): void {
  profileCache = null
}

export async function fetchDeviceProfileCached(force = false): Promise<DeviceProfile> {
  const now = Date.now()
  if (!force && profileCache && now - profileCache.fetchedAt < PROFILE_CACHE_TTL_MS) {
    return profileCache.profile
  }
  const profile = await fetchDeviceProfile()
  profileCache = { profile, fetchedAt: now }
  return profile
}

export {
  exchangeAuthToken,
  getBillingUrl,
  getCalendarConnectUrl,
  getConnectPageUrl,
  getDashboardUrl,
  getPrivacyUrl,
  getSignInUrl,
  getTermsUrl,
  type DesktopAuthProvider,
} from './protocolAuth'
