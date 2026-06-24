import type { DeviceProfile, SettingsTab } from './types'
import { SETTINGS_TABS } from './types'

const AVATAR_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#0ea5e9', '#f59e0b']

export function formatHistoryTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export function formatSessionDuration(start: number, end: number): string {
  const mins = Math.max(1, Math.round((end - start) / 60_000))
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function profileInitials(profile: DeviceProfile): string {
  const first = profile.firstName?.trim()?.[0] ?? ''
  const last = profile.lastName?.trim()?.[0] ?? ''
  if (first || last) return `${first}${last}`.toUpperCase()
  const full = profile.fullName?.trim() || profile.email?.split('@')[0] || 'U'
  return full.slice(0, 1).toUpperCase()
}

export function avatarPlaceholderColor(profile: DeviceProfile): string {
  const seed = profile.email ?? profile.fullName ?? profile.userId ?? 'user'
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i)) % AVATAR_COLORS.length
  }
  return AVATAR_COLORS[hash]
}

export function hasUploadedAvatar(profile: DeviceProfile): boolean {
  return Boolean(profile.localAvatarUrl?.startsWith('data:image/'))
}

export function hasCommunitiesAccess(profile: DeviceProfile | null): boolean {
  if (!profile?.paired) return false
  if (profile.entitlements?.includes('communities')) return true
  return profile.plan === 'pro_plus'
}

export function normalizeSettingsTab(value: unknown): SettingsTab | null {
  if (value === 'general') return 'models'
  if (typeof value === 'string' && SETTINGS_TABS.includes(value as SettingsTab)) {
    return value as SettingsTab
  }
  return null
}
