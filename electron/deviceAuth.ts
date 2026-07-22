import { app } from 'electron'
import fetch from 'node-fetch'
import * as fs from 'fs'
import * as path from 'path'

import { getClarifiApiUrl } from './keys'
import { deleteKey, getKey } from './store'
import { exchangeAuthToken, getConnectPageUrl } from './protocolAuth'

const DEVICE_ID_KEY = 'device_id'
const DEVICE_SECRET_KEY = 'device_secret'
const PROFILE_CACHE_FILE = 'device-profile.json'

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

function profileCachePath(): string {
  return path.join(app.getPath('userData'), PROFILE_CACHE_FILE)
}

function readCachedProfile(): DeviceProfile | null {
  try {
    const raw = fs.readFileSync(profileCachePath(), 'utf8')
    const parsed = JSON.parse(raw) as DeviceProfile
    if (!parsed || typeof parsed !== 'object') return null
    return { ...parsed, paired: true }
  } catch {
    return null
  }
}

function writeCachedProfile(profile: DeviceProfile): void {
  try {
    fs.writeFileSync(
      profileCachePath(),
      JSON.stringify({
        paired: true,
        userId: profile.userId,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        fullName: profile.fullName,
        plan: profile.plan,
        planLabel: profile.planLabel,
        entitlements: profile.entitlements,
      }),
    )
  } catch {
    // ignore cache write failures
  }
}

function clearCachedProfile(): void {
  try {
    const filePath = profileCachePath()
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {
    // ignore
  }
}

export async function clearLocalDeviceCredentials(): Promise<void> {
  await deleteKey(DEVICE_ID_KEY)
  await deleteKey(DEVICE_SECRET_KEY)
  clearCachedProfile()
  profileCache = null
}

export async function fetchDeviceProfile(): Promise<DeviceProfile> {
  const creds = await getDeviceCredentials()
  const baseUrl = getClarifiApiUrl()
  if (!creds || !baseUrl) {
    if (creds) {
      const cached = readCachedProfile()
      if (cached) return cached
    }
    return { paired: false }
  }

  try {
    const response = await fetch(`${baseUrl}/api/desktop/profile`, {
      headers: {
        'X-Clarifi-Device-Id': creds.deviceId,
        'X-Clarifi-Device-Secret': creds.deviceSecret,
      },
    })

    if (response.status === 401 || response.status === 403) {
      await clearLocalDeviceCredentials()
      return { paired: false }
    }

    if (!response.ok) {
      const cached = readCachedProfile()
      if (cached) return cached
      // Local credentials still exist — stay paired even if the API is briefly down.
      return { paired: true }
    }

    const data = (await response.json()) as DeviceProfile
    const profile = { ...data, paired: Boolean(data.paired) }
    if (profile.paired) {
      writeCachedProfile(profile)
      return profile
    }

    // Server says unpaired while we still have local secrets — treat as invalid.
    await clearLocalDeviceCredentials()
    return { paired: false }
  } catch {
    const cached = readCachedProfile()
    if (cached) return cached
    return { paired: true }
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
