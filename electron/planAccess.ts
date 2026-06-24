import { isDictationEnabled, applyDictationEnabledSideEffects } from './dictationControl'
import { refreshDictationBlockedFromAudioSession, setDictationBlocked } from './dictationPill'
import {
  getEntitlements,
  hasFeature,
  normalizePlan,
  upgradePlanForFeature,
} from '../shared/entitlements'
import type { Feature, Plan } from '../shared/entitlements'
import { fetchDeviceProfileCached } from './deviceAuth'
import { getBillingUrl } from './protocolAuth'

export type { Feature, Plan }

export { getEntitlements, hasFeature, normalizePlan }

export async function getDevicePlan(force = false): Promise<Plan> {
  const profile = await fetchDeviceProfileCached(force)
  return normalizePlan(profile.plan)
}

export type DeviceFeatureGate =
  | { ok: true; plan: Plan }
  | {
      ok: false
      error: 'plan_required'
      feature: Feature
      upgrade: 'pro' | 'pro_plus'
      billingUrl: string
    }

export async function requireDeviceFeature(
  feature: Feature,
  forceProfile = false,
): Promise<DeviceFeatureGate> {
  const plan = await getDevicePlan(forceProfile)
  if (hasFeature(plan, feature)) {
    return { ok: true, plan }
  }

  return {
    ok: false,
    error: 'plan_required',
    feature,
    upgrade: upgradePlanForFeature(feature),
    billingUrl: getBillingUrl(),
  }
}

export async function syncStealthEntitlement(): Promise<void> {
  const plan = await getDevicePlan(false)
  if (hasFeature(plan, 'stealth')) return

  const { setContentProtectionEnabled, isContentProtectionEnabled } = await import('./overlay')
  if (isContentProtectionEnabled()) {
    setContentProtectionEnabled(false)
  }
}

export async function syncDictationEntitlement(): Promise<void> {
  const gate = await requireDeviceFeature('voice_dictation')

  if (!gate.ok) {
    applyDictationEnabledSideEffects(false)
    setDictationBlocked(true, 'Start a 7-day free trial to use voice dictation')
    return
  }

  refreshDictationBlockedFromAudioSession()
  if (isDictationEnabled()) {
    applyDictationEnabledSideEffects(true)
  }
}

export async function syncPlanEntitlements(forceProfile = false): Promise<void> {
  await getDevicePlan(forceProfile)
  await syncStealthEntitlement()
  await syncDictationEntitlement()
}
